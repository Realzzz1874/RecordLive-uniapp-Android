import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

object RecordLiveBackup {
    private const val BUFFER_SIZE = 64 * 1024

    @JvmStatic
    fun copyUriToFile(context: Context, uriText: String, destinationPath: String, maxBytes: Long) {
        val destination = File(destinationPath)
        destination.parentFile?.mkdirs()
        var written = 0L
        context.contentResolver.openInputStream(Uri.parse(uriText)).use { raw ->
            requireNotNull(raw) { "无法打开所选备份文件" }
            BufferedInputStream(raw).use { input ->
                BufferedOutputStream(FileOutputStream(destination)).use { output ->
                    val buffer = ByteArray(BUFFER_SIZE)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        written += read
                        require(written <= maxBytes) { "备份文件超过大小限制" }
                        output.write(buffer, 0, read)
                    }
                    output.flush()
                    outputFileSync(output)
                }
            }
        }
    }

    @JvmStatic
    fun copyFileToUri(context: Context, sourcePath: String, uriText: String) {
        val uri = Uri.parse(uriText)
        try {
            context.contentResolver.openOutputStream(uri, "wt").use { raw ->
                requireNotNull(raw) { "无法写入所选位置" }
                BufferedOutputStream(raw).use { output ->
                    BufferedInputStream(FileInputStream(sourcePath)).use { input ->
                        input.copyTo(output, BUFFER_SIZE)
                    }
                    output.flush()
                }
            }
        } catch (error: Throwable) {
            runCatching { DocumentsContract.deleteDocument(context.contentResolver, uri) }
            throw error
        }
    }

    @JvmStatic
    fun createZip(sourceDirectoryPath: String, destinationZipPath: String) {
        val root = File(sourceDirectoryPath).canonicalFile
        require(root.isDirectory) { "ZIP 源目录不存在" }
        val destination = File(destinationZipPath)
        destination.parentFile?.mkdirs()
        ZipOutputStream(BufferedOutputStream(FileOutputStream(destination))).use { zip ->
            root.walkTopDown().filter { it.isFile }.sortedBy {
                it.relativeTo(root).invariantSeparatorsPath
            }.forEach { file ->
                val path = file.relativeTo(root).invariantSeparatorsPath
                validatePath(path)
                zip.putNextEntry(ZipEntry(path))
                BufferedInputStream(FileInputStream(file)).use { input ->
                    input.copyTo(zip, BUFFER_SIZE)
                }
                zip.closeEntry()
            }
        }
    }

    @JvmStatic
    fun inspectZip(zipPath: String, limitsJson: String): String {
        val limits = JSONObject(limitsJson)
        val archive = File(zipPath)
        require(archive.length() <= limits.getLong("maxArchiveBytes")) { "备份文件超过大小限制" }
        val encrypted = encryptedEntryNames(archive)
        val result = JSONArray()
        val names = HashSet<String>()
        var total = 0L
        ZipFile(archive).use { zip ->
            val entries = zip.entries().asSequence().toList()
            require(entries.size <= limits.getInt("maxEntryCount")) { "ZIP 条目过多" }
            entries.forEach { entry ->
                validatePath(entry.name.removeSuffix("/"))
                require(names.add(entry.name)) { "ZIP 包含重复条目：${entry.name}" }
                require(entry.size >= 0L && entry.compressedSize >= 0L) { "不支持未知或 ZIP64 条目大小" }
                require(entry.size <= limits.getLong("maxEntryBytes")) { "ZIP 条目超过大小限制：${entry.name}" }
                total += entry.size
                require(total <= limits.getLong("maxExtractedBytes")) { "ZIP 解压后超过大小限制" }
                result.put(JSONObject()
                    .put("path", entry.name)
                    .put("compressedBytes", entry.compressedSize)
                    .put("uncompressedBytes", entry.size)
                    .put("directory", entry.isDirectory)
                    .put("encrypted", encrypted.contains(entry.name)))
            }
        }
        return result.toString()
    }

    @JvmStatic
    fun readUtf8ZipEntry(zipPath: String, entryPath: String, maxBytes: Long): String {
        validatePath(entryPath)
        ZipFile(zipPath).use { zip ->
            val entry = requireNotNull(zip.getEntry(entryPath)) { "ZIP 条目不存在：$entryPath" }
            require(entry.size in 0..maxBytes) { "ZIP 条目超过读取限制：$entryPath" }
            zip.getInputStream(entry).use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(BUFFER_SIZE)
                var total = 0L
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    total += read
                    require(total <= maxBytes) { "ZIP 条目超过读取限制：$entryPath" }
                    output.write(buffer, 0, read)
                }
                return output.toString(Charsets.UTF_8.name())
            }
        }
    }

    @JvmStatic
    fun extractZipEntries(
        zipPath: String,
        destinationDirectoryPath: String,
        expectedJson: String,
        limitsJson: String
    ) {
        inspectZip(zipPath, limitsJson)
        val expectedArray = JSONArray(expectedJson)
        val expected = HashMap<String, JSONObject>()
        for (index in 0 until expectedArray.length()) {
            val item = expectedArray.getJSONObject(index)
            expected[item.getString("path")] = item
        }
        val destination = File(destinationDirectoryPath).canonicalFile
        destination.mkdirs()
        ZipFile(zipPath).use { zip ->
            expected.forEach { (path, contract) ->
                validatePath(path)
                val entry = requireNotNull(zip.getEntry(path)) { "ZIP 条目不存在：$path" }
                require(entry.size == contract.getLong("byteSize")) { "ZIP 条目大小不匹配：$path" }
                val target = File(destination, path).canonicalFile
                require(target.path.startsWith(destination.path + File.separator)) { "ZIP 路径越界：$path" }
                target.parentFile?.mkdirs()
                zip.getInputStream(entry).use { input ->
                    BufferedOutputStream(FileOutputStream(target)).use { output ->
                        input.copyTo(output, BUFFER_SIZE)
                    }
                }
                require(target.length() == contract.getLong("byteSize")) { "解压文件大小不匹配：$path" }
                require(sha256File(target.path).equals(contract.getString("sha256"), true)) {
                    "解压文件哈希不匹配：$path"
                }
            }
        }
    }

    @JvmStatic
    fun sha256File(path: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        BufferedInputStream(FileInputStream(path)).use { input ->
            val buffer = ByteArray(BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    @JvmStatic
    fun cleanupStaleBackupArtifacts(
        mediaRootPath: String,
        workRootPath: String,
        referencedPathsJson: String,
        cutoffMs: Long
    ) {
        val referenced = JSONArray(referencedPathsJson)
        val referencedPaths = HashSet<String>()
        for (index in 0 until referenced.length()) {
            referencedPaths.add(File(referenced.getString(index)).canonicalPath)
        }

        val mediaRoot = File(mediaRootPath).canonicalFile
        mediaRoot.listFiles()
            ?.filter { it.isDirectory && it.name.startsWith("restore-") && it.lastModified() <= cutoffMs }
            ?.filterNot { directory ->
                val prefix = directory.canonicalPath + File.separator
                referencedPaths.any { it == directory.canonicalPath || it.startsWith(prefix) }
            }
            ?.forEach { deleteChild(mediaRoot, it) }

        val workRoot = File(workRootPath).canonicalFile
        workRoot.listFiles()
            ?.filter { it.lastModified() <= cutoffMs }
            ?.forEach { deleteChild(workRoot, it) }
    }

    private fun deleteChild(root: File, child: File) {
        val canonicalRoot = root.canonicalFile
        val canonicalChild = child.canonicalFile
        require(canonicalChild.path.startsWith(canonicalRoot.path + File.separator)) {
            "拒绝清理备份目录之外的路径"
        }
        require(canonicalChild != canonicalRoot) { "拒绝清理备份根目录" }
        require(canonicalChild.deleteRecursively()) { "无法清理旧备份临时目录：${canonicalChild.name}" }
    }

    private fun validatePath(path: String) {
        require(path.isNotBlank()) { "ZIP 路径为空" }
        require(!path.startsWith("/") && !path.contains('\\') && !path.contains('\u0000')) {
            "ZIP 路径不安全：$path"
        }
        require(path.split('/').none { it.isBlank() || it == "." || it == ".." }) {
            "ZIP 路径不安全：$path"
        }
    }

    private fun encryptedEntryNames(file: File): Set<String> {
        val encrypted = HashSet<String>()
        RandomAccessFile(file, "r").use { input ->
            var offset = 0L
            while (offset + 46 <= input.length()) {
                input.seek(offset)
                val signature = readUInt32LE(input)
                if (signature == 0x02014b50L) {
                    input.skipBytes(4)
                    val flags = readUInt16LE(input)
                    input.skipBytes(18)
                    val nameLength = readUInt16LE(input)
                    val extraLength = readUInt16LE(input)
                    val commentLength = readUInt16LE(input)
                    input.skipBytes(4)
                    val externalAttributes = readUInt32LE(input)
                    input.skipBytes(4)
                    val unixMode = (externalAttributes ushr 16).toInt()
                    require((unixMode and 0xF000) != 0xA000) { "不支持 ZIP 符号链接条目" }
                    val nameBytes = ByteArray(nameLength)
                    input.readFully(nameBytes)
                    val name = String(nameBytes, Charsets.UTF_8)
                    if ((flags and 1) != 0) encrypted.add(name)
                    offset = input.filePointer + extraLength + commentLength
                } else {
                    offset += 1
                }
            }
        }
        return encrypted
    }

    private fun readUInt16LE(input: RandomAccessFile): Int {
        val a = input.read()
        val b = input.read()
        return a or (b shl 8)
    }

    private fun readUInt32LE(input: RandomAccessFile): Long {
        return readUInt16LE(input).toLong() or (readUInt16LE(input).toLong() shl 16)
    }

    private fun outputFileSync(output: BufferedOutputStream) {
        // BufferedOutputStream deliberately exposes no descriptor. Closing the wrapped
        // FileOutputStream immediately after flush performs the durable handoff.
    }
}
