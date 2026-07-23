# RecordLive Android Local Backup Contract v1

状态：Milestone 5 本机备份与恢复 v1 的 M5.1–M5.5 已实现，并完成写锁范围、失败媒体回收、启动期孤儿目录清理和文件选择监听解绑闭环；备份功能仅在 Android App 注册，Android 自定义基座与真机验收仍待用户授权。

本契约只用于 RecordLive Android 应用自身的本机数据备份和恢复。它不用于 iOS 与 Android 之间的数据迁移、导入、导出或同步，也不定义 WebDAV、网盘、自动备份或跨设备同步。

## 1. v1 范围与产品决策

v1 只提供：

- 手动“备份到文件”；
- 手动“从文件恢复”，恢复时选择“全部覆盖”或“与本机合并”；
- 恢复前自动生成一份应用内部恢复点；
- 恢复成功后允许使用该恢复点撤销上一次恢复；
- 恢复完成后显示新增、复用、跳过、补齐和冲突统计。

v1 明确不提供：

- iCloud、WebDAV、网盘或应用自建云端；
- 定时、后台或系统级自动备份；
- iOS 备份格式、Android/iOS 互导或其它应用的数据导入；
- 按记录勾选恢复、逐字段编辑冲突或跨设备双向同步；
- 备份文件分享入口；
- 密码、密钥、购买凭证、登录态或其它敏感配置；
- 备份文件加密。

恢复有两个明确模式：

- **全部覆盖**：备份内的数据是恢复后的唯一业务数据；当前记录、分类、标签、用户字典、可备份设置和媒体引用会被替换；
- **与本机合并**：只新增或补齐数据，不删除本机可见记录；同一实体发生冲突时采用“本机优先”，不静默覆盖本机标量字段。

合并不是按名称猜测演出是否相同，也不是按更新时间自动覆盖。演出身份只由稳定 UUID 判断；分类和标签可以按规范化名称复用。具体规则见“7.4 合并恢复规则”。

恢复模式不写入备份文件。同一个合规 v1 备份可以在恢复时任选“全部覆盖”或“与本机合并”，因此本次重设计不提升 `schemaVersion`。

v1 文件未加密，页面必须提示备份可能包含演出地点、座位、备注、票根等隐私内容，并建议用户妥善保管。

## 2. 页面与交互

入口固定在“设置 > 记录管理 > 本地备份与恢复”。

页面包含：

1. 数据摘要：演出数量、媒体数量、媒体总大小、上次成功备份时间；
2. 主操作“备份到文件”；
3. 操作“从文件恢复”，校验后再选择“全部覆盖”或“与本机合并”；
4. 存在内部恢复点时显示“撤销上次恢复”；
5. 未加密、两种恢复语义和仅支持 Android 本机备份格式的说明。

### 2.1 备份到文件

```text
点击“备份到文件”
  -> 锁定本轮用户数据写入
  -> 生成一致性数据快照
  -> 校验全部引用媒体
  -> 在应用临时目录生成并回读校验 ZIP
  -> 解除用户数据写入锁
  -> 打开 Android 系统“新建文档”界面
  -> 用户选择文件名和本机保存位置
  -> 将临时 ZIP 流式写入目标文档
  -> 写入完成后记录“上次成功备份时间”
  -> 清理临时文件
```

用户取消系统界面不算失败，也不得更新上次成功备份时间。无演出但存在分类、标签、用户字典或设置时仍允许生成备份。

### 2.2 从文件恢复

```text
点击“从文件恢复”
  -> 打开 Android 系统“打开文档”界面
  -> 复制到应用临时目录并限制压缩包大小
  -> 只读检查 ZIP 目录和条目
  -> 校验 manifest、data.json、媒体大小和 SHA-256
  -> 校验字段、唯一键和全部引用关系
  -> 展示备份摘要与兼容性结果
  -> 用户选择“全部覆盖”或“与本机合并”
  -> 读取本机快照并生成对应恢复计划
  -> 展示预计结果、冲突和空间需求
  -> 用户确认恢复模式
  -> 锁定用户数据写入
  -> 重新读取本机状态并复算恢复计划
  -> 计划与预览不一致时中止并要求重新确认
  -> 生成并验证当前数据的内部恢复点
  -> 将计划需要的备份媒体写入新的媒体 generation
  -> 在一个 SQLite 事务中执行覆盖或合并计划
  -> 事务提交后重新加载 Repository 与应用 Store
  -> 延后清理无引用旧媒体和临时文件
```

确认页至少显示：

- 备份时间；
- 生成备份的应用版本；
- 演出、分类、标签和媒体数量；
- 媒体总大小；
- 选择“全部覆盖”时，显示当前数据将被完整替换的红色警告；
- 选择“与本机合并”时，显示预计新增、复用、补齐、跳过冲突和疑似重复数量；
- 合并模式固定“本机优先”，本机已有字段不会被备份静默覆盖；
- 校验警告；没有警告时明确显示“完整性校验通过”。

不支持的更高版本只显示“请更新应用后再恢复”，不得进入模式选择。取消、校验失败、计划变化或空间不足均不得改变当前数据。

### 2.3 撤销上次恢复

每次正式恢复前生成一个应用内部恢复点：

```text
_doc/recordlive/recovery/last-before-restore.backup.zip
```

恢复点使用与手动备份相同的 v1 契约和完整校验，只保留最近一份。新恢复点必须先写入临时文件并通过回读校验，再原子替换旧恢复点。

“撤销上次恢复”仍走同一套预览、确认和恢复流程。开始撤销时先把原恢复点复制到独立临时文件，再为当前状态生成新的恢复点，避免覆盖本轮恢复源；因此连续两次操作可以在恢复前后状态之间切换。用户可在页面中删除恢复点，删除前需二次确认。

如果无法生成有效恢复点，正式恢复不得开始；不能用“尽力而为”的不完整副本替代恢复点。

## 3. Android 平台边界

文件导入和导出使用 Android Storage Access Framework：

- 导出使用 `ACTION_CREATE_DOCUMENT`；
- 恢复使用 `ACTION_OPEN_DOCUMENT`；
- 两个 Intent 都设置 `EXTRA_LOCAL_ONLY=true`，不显示需要从远端下载的文档；
- 通过 `ContentResolver` 流式读取或写入所选 URI；
- 不请求全盘读写权限，不依赖固定外部存储路径；
- 应用不持久化无必要的 URI 授权。

uni-app 的 `uni.chooseFile` 不作为 App 端实现，因为该 API 不支持 App 选择普通文件。Android 能力收敛在本项目的 UTS API 插件中，由插件封装系统文档选择器、ZIP 条目读取、受限解压、流式复制和可用空间查询。

ZIP 不直接交给无条目预检能力的解压接口。UTS 插件使用 Android 标准 `ZipFile`、`ZipInputStream` 和 `ZipOutputStream`，先枚举并验证全部条目，再把允许的文件写入应用临时目录。

H5 不注册备份 Repository、不提供假文件网关，也不显示备份入口。H5 构建仅用于确认 Android 条件编译边界没有破坏项目其它页面。

### 3.1 UTS 插件可执行形态

插件目录固定为：

```text
src/uni_modules/recordlive-backup/
  package.json
  utssdk/
    interface.uts
    app-android/
      index.uts
      config.json
```

`interface.uts` 至少暴露：

```ts
type LocalDocument = {
  uri: string
  displayName: string
  byteSize: number | null
}

type ZipLimits = {
  maxArchiveBytes: number
  maxEntryCount: number
  maxEntryBytes: number
  maxExtractedBytes: number
}

type ZipEntryInfo = {
  path: string
  compressedBytes: number
  uncompressedBytes: number
  directory: boolean
  encrypted: boolean
}

type ZipExpectedEntry = {
  path: string
  byteSize: number
  sha256: string
}

export function createLocalDocument(
  suggestedName: string,
  success: (document: LocalDocument) => void,
  cancel: () => void,
  fail: (message: string) => void,
): void

export function openLocalBackupDocument(
  success: (document: LocalDocument) => void,
  cancel: () => void,
  fail: (message: string) => void,
): void

export function copyUriToSandbox(
  uri: string,
  destinationPath: string,
  maxBytes: number,
  success: () => void,
  fail: (message: string) => void,
): void

export function copySandboxToUri(
  sourcePath: string,
  uri: string,
  success: () => void,
  fail: (message: string) => void,
): void

export function createZip(
  sourceDirectoryPath: string,
  destinationZipPath: string,
  success: () => void,
  fail: (message: string) => void,
): void

export function inspectZip(
  zipPath: string,
  limits: ZipLimits,
  success: (entries: ZipEntryInfo[]) => void,
  fail: (message: string) => void,
): void

export function readUtf8ZipEntry(
  zipPath: string,
  entryPath: string,
  maxBytes: number,
  success: (content: string) => void,
  fail: (message: string) => void,
): void

export function extractZipEntries(
  zipPath: string,
  destinationDirectoryPath: string,
  expectedEntries: ZipExpectedEntry[],
  limits: ZipLimits,
  success: () => void,
  fail: (message: string) => void,
): void

export function sha256File(
  path: string,
  success: (sha256: string) => void,
  fail: (message: string) => void,
): void

export function availableBytes(
  path: string,
  success: (bytes: number) => void,
  fail: (message: string) => void,
): void
```

Android 实现要求：

- 使用两个不与其它插件冲突的固定 request code；
- 通过 `UTSAndroid.getUniActivity()` 启动 Intent；
- 通过 `UTSAndroid.onAppActivityResult` 接收结果，并在完成、取消和页面销毁时调用对应的 `off` 方法移除监听；
- Intent MIME 使用 `application/zip`，同时以 `.backup.zip` 文件名作为 RecordLive 格式识别的一部分；
- 所有 `ContentResolver`、ZIP、哈希和复制工作运行在 IO dispatcher，不阻塞 JS 或主线程；
- 输入输出使用固定大小缓冲区流式处理，不把整个 ZIP 或媒体读入 JS 内存；
- TypeScript 适配层先把 `_doc` 路径转换成 UTS 可访问的绝对沙盒路径；
- `inspectZip` 读取中央目录，并检查通用标志位中的加密位、ZIP64 大小、重复路径和条目总量；
- `extractZipEntries` 只接收已经由 domain 层核对过的 manifest 文件清单，边解压边限制实际字节数；
- `createZip` 把源目录的内容写到 ZIP 根目录，不把临时 operation 目录名带入容器；
- 写入目标 URI 后 flush，并在 provider 支持时同步文件描述符；
- 写入用户目标 URI 失败时，尝试通过 `DocumentsContract.deleteDocument` 删除不完整文档；provider 不支持删除时明确提示用户手动删除该文件；
- 不增加 Share 模块、外部存储权限或第三方 ZIP 依赖；
- 进度事件最多每 200 ms 上报一次，页面卸载只解除 UI 订阅，不中断已经进入提交阶段的恢复事务。

应用沙盒目录：

```text
_doc/recordlive/
  recordlive.db
  media/
    <现有平铺媒体文件>             兼容当前新增和编辑产生的媒体
    restore-<operation-id>/       恢复时生成的媒体 generation
  backup-work/
    <operation-id>/               临时 ZIP、data 和检查结果
  recovery/
    last-before-restore.backup.zip
```

启动清理只能删除数据库无引用且超过安全期限的 `restore-*` 和 `backup-work` 内容。

## 4. 分层与接口

依赖方向：

```text
BackupScreen
  -> BackupUseCase / RestoreUseCase
      -> BackupSnapshotRepository
      -> BackupArchiveGateway
      -> RestorePlanner
      -> DataOperationCoordinator

SQLiteBackupSnapshotRepository -> DatabaseDriver
AndroidBackupArchiveGateway     -> UTS SAF/ZIP API
```

建议接口：

```ts
interface BackupSnapshotRepository {
  exportSnapshot(): Promise<AndroidBackupDataV1>
  loadRestoreState(): Promise<CurrentRestoreState>
  applyRestorePlan(plan: RestorePlan, media: StagedMediaGeneration): Promise<void>
}

type RestoreMode = 'replace-all' | 'merge-local-first'

interface RestorePlanContext {
  operationId: string
  appliedAtMs: number
}

interface RestorePlanner {
  plan(
    current: CurrentRestoreState,
    backup: AndroidBackupDataV1,
    mode: RestoreMode,
    context: RestorePlanContext,
  ): RestorePlan
}

interface BackupArchiveGateway {
  createArchive(input: BackupArchiveInput): Promise<PreparedBackupArchive>
  chooseRestoreFile(): Promise<SelectedBackupFile | null>
  inspectArchive(file: SelectedBackupFile): Promise<InspectedBackupArchive>
  stageMedia(archive: InspectedBackupArchive): Promise<StagedMediaGeneration>
  saveArchiveToUserFile(archive: PreparedBackupArchive): Promise<boolean>
}

interface DataOperationCoordinator {
  withMutation<T>(operation: () => Promise<T>): Promise<T>
  withExclusiveDataAccess<T>(operation: () => Promise<T>): Promise<T>
}
```

约束：

- `src/domain/backup.ts` 只保存纯类型、格式校验、引用校验和版本升级器，不导入 Vue、`uni` 或 `plus`；
- `src/features/backup/` 负责备份、检查、确认、恢复和撤销 use case；
- `src/platform/backup/` 负责 SQLite 快照、临时目录、媒体 generation 和 UTS 网关；
- 页面不直接执行 SQL、文件操作、ZIP 或 Android Intent；
- 演出、分类、标签、设置和媒体的所有写操作通过 `withMutation`，备份和恢复通过 `withExclusiveDataAccess`，避免快照或恢复期间出现并发写入；
- `RestorePlanner` 是纯函数：相同的本机快照、备份、模式和 `RestorePlanContext` 必须产生相同计划，页面展示的统计直接来自计划；
- `RestorePlanContext` 固定本轮 `operationId` 和 `appliedAtMs`；需要重映射的 UUID 由 `SHA-256(operationId + entityKind + sourceId)` 确定性生成，重新加锁复算时不得产生另一组随机 ID；
- `RestorePlan` 使用规范化 JSON 计算 `planFingerprint`；加锁后复算的 fingerprint 不一致时，释放锁并回到预览页面；
- 正式实现前，当前散落在 `uni` storage 的主题、购票渠道、朋友和自定义厂牌迁移到 `app_settings`，使可备份用户设置能够与业务数据在同一个 SQLite 事务中恢复。

### 4.1 落地文件清单

运行时实现按当前工程结构落在：

```text
src/domain/backup.ts
  v1 manifest、data 类型和基础 validator
src/domain/backup-restore-plan.ts
  RestoreMode、RestorePlan、规范化和纯合并计划
src/features/backup/BackupScreen.vue
  数据摘要、文件检查、模式选择、计划预览、进度和结果
src/features/backup/use-cases.ts
  createBackup、inspectBackup、restoreBackup、undoLastRestore
src/features/backup/repository.ts
  feature 层所需接口
src/platform/backup/sqlite-backup-snapshot-repository.ts
  当前状态读取、快照导出和计划事务执行
src/platform/backup/android-backup-archive-gateway.ts
  UTS API 的 TypeScript 适配
src/platform/backup/data-operation-coordinator.ts
  普通写入与备份恢复互斥
src/uni_modules/recordlive-backup/
  Android SAF、流、ZIP、哈希和空间查询
tests/backup-*.test.ts
  契约、计划、Repository、故障注入和幂等性
```

现有接入点：

- `SettingsScreen.vue` 把当前计划提示改为 `openBackup` 事件；
- `src/pages/index/index.vue` 复用现有内部 screen 导航打开 `BackupScreen`，入口和页面装配使用 `APP-PLUS` 条件编译；
- Repository factory 注入同一个 `DataOperationCoordinator`；
- `src/manifest.json` 不增加外部存储权限、Share 模块或云端 SDK；
- 恢复成功后清空详情/编辑 screen，回到“记录”Tab，并让浏览、待观看、印记和设置 Store 从 Repository 重新加载。

### 4.2 可备份设置收口

M5.2 先完成一次性设置迁移：

1. 对主题、购票渠道、朋友和自定义厂牌逐个读取旧 `uni` storage；
2. 目标 `app_settings` key 不存在时，对旧值 normalize 后写入 SQLite；
3. 回读 SQLite 并确认值一致；
4. 写入 `local-settings-migrated-v1` 设备级标记；
5. App 端 Store 和 Picker 改为只通过 `AppSettingsRepository` 读写；
6. 本阶段暂不删除旧 `uni` storage 值，待后续版本确认迁移稳定后再清理。

迁移失败时继续使用旧读取路径并显示可重试诊断，不得用默认值覆盖已有用户字典。H5 的 `UniStorageAppSettingsRepository` 继续作为同接口开发实现，不代表 Android 存储仍以 `uni` storage 为业务来源。

## 5. 备份容器

文件名：

```text
RecordLive-Android-YYYYMMDD-HHmmss.backup.zip
```

ZIP 根目录只允许：

```text
manifest.json
data.json
media/
  <asset-id>.jpg
```

`manifest.json` 不记录自身哈希。`files` 必须与 ZIP 中除目录和 `manifest.json` 外的条目一一对应，不允许未声明条目或重复路径。

```json
{
  "schemaVersion": 1,
  "backupKind": "android-local",
  "appVersion": "0.1.0",
  "exportedAtMs": 1784201400000,
  "dataFile": "data.json",
  "files": [
    {
      "path": "data.json",
      "byteSize": 12345,
      "sha256": "64位十六进制SHA-256"
    },
    {
      "path": "media/7d97d65e-2ba1-4ef7-83ba-d405baa942d2.jpg",
      "byteSize": 123456,
      "sha256": "64位十六进制SHA-256"
    }
  ]
}
```

容器要求：

- JSON 使用 UTF-8，不带 BOM；
- 时间戳使用 Unix 毫秒和安全整数；
- 金额使用普通十进制字符串，不使用浮点数、指数、`NaN` 或 `Infinity`；
- 货币使用大写 ISO 4217 三字母代码；
- 路径统一使用 `/`；
- 拒绝绝对路径、空路径、反斜线、`.`、`..`、NUL 和重复路径；
- 拒绝加密 ZIP、符号链接、未知根条目和未在 manifest 中声明的文件；
- v1 只接受 `data.json` 作为 `dataFile`；
- v1 媒体只接受 JPEG，扩展名为 `.jpg`，MIME 为 `image/jpeg`；
- ZIP 生成完成后必须重新打开并执行与恢复相同的结构、大小和哈希检查。

## 6. data.json

顶层键固定为：

```json
{
  "performances": [],
  "categories": [],
  "tags": [],
  "performanceTags": [],
  "performanceFacets": [],
  "songs": [],
  "mediaAssets": [],
  "settings": []
}
```

只导出用户当前可见的演出、分类和标签，即 `deleted_at_ms IS NULL`。软删除行、孤儿文件、临时媒体、缓存和恢复操作日志不进入备份。

数组按稳定顺序输出，确保相同快照生成确定性的 `data.json`：

- 主实体按 `id`；
- 关系按外键组合；
- facet 按 `performanceId`、`kind`、`sortOrder`；
- 设置按 `key`。

### 6.1 performances

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 稳定 UUID |
| `name` | string | 是 | trim 后非空 |
| `startedAtMs` | integer | 是 | Unix 毫秒 |
| `city` | string | 是 | 可为空字符串 |
| `venue` | string | 是 | 可为空字符串 |
| `remark` | string | 是 | 可为空字符串 |
| `ticketPriceAmount` | string | 是 | 普通十进制字符串 |
| `ticketPriceCurrency` | string | 是 | 默认 CNY |
| `paidPriceAmount` | string | 是 | 普通十进制字符串 |
| `paidPriceCurrency` | string | 是 | 默认 CNY |
| `otherCostAmount` | string | 是 | 普通十进制字符串 |
| `otherCostCurrency` | string | 是 | 默认 CNY |
| `seat` | string | 是 | 可为空字符串 |
| `rating` | number | 是 | `0...5` |
| `status` | integer | 是 | `0`、`1`、`2`、`3` |
| `categoryId` | string/null | 是 | 必须引用 categories 或为 null |
| `latitude` | number/null | 是 | 与 longitude 同时为空或同时存在 |
| `longitude` | number/null | 是 | 与 latitude 同时为空或同时存在 |
| `createdAtMs` | integer | 是 | 创建时间 |
| `updatedAtMs` | integer | 是 | 修改时间 |

### 6.2 categories 与 tags

```json
{
  "id": "稳定 UUID",
  "name": "名称",
  "sortOrder": 0,
  "createdAtMs": 1784201400000,
  "updatedAtMs": 1784201400000
}
```

名称 trim 后非空；同一数组内 ID 不得重复，分类和标签各自的规范化名称也不得重复。

### 6.3 performanceTags

```json
{
  "performanceId": "演出 UUID",
  "tagId": "标签 UUID",
  "createdAtMs": 1784201400000
}
```

`performanceId` 和 `tagId` 必须存在；组合键不得重复。

### 6.4 performanceFacets

阵容、嘉宾、剧目、渠道、朋友和厂牌使用统一多值结构，厂牌内部类型继续使用 `company`：

```json
{
  "performanceId": "演出 UUID",
  "kind": "artist",
  "value": "名称",
  "sortOrder": 0
}
```

`kind` 只能是 `artist`、`guest`、`play`、`channel`、`friend`、`company`；`value` trim 后非空；同一演出、类型和值的组合不得重复。

### 6.5 songs

```json
{
  "id": "稳定 UUID",
  "performanceId": "演出 UUID",
  "artistName": "艺人名称",
  "titles": ["歌曲 A", "歌曲 B"],
  "createdAtMs": 1784201400000,
  "updatedAtMs": 1784201400000
}
```

`performanceId` 必须存在；`titles` 只包含字符串，恢复时再序列化到 SQLite 的 `titles_json`。

### 6.6 mediaAssets

```json
{
  "id": "7d97d65e-2ba1-4ef7-83ba-d405baa942d2",
  "performanceId": "演出 UUID",
  "kind": "poster",
  "archivePath": "media/7d97d65e-2ba1-4ef7-83ba-d405baa942d2.jpg",
  "mimeType": "image/jpeg",
  "byteSize": 123456,
  "sha256": "64位十六进制SHA-256",
  "width": 1200,
  "height": 1600,
  "createdAtMs": 1784201400000
}
```

媒体类型只能是 `poster`、`poster_thumb`、`ticket_original`、`ticket_thumb`。`archivePath` 是 ZIP 内路径，不是数据库的 `_doc` 路径。恢复时生成新的应用沙盒路径：

```text
_doc/recordlive/media/restore-<operation-id>/<asset-id>.jpg
```

同一演出、同一媒体类型只能有一条。每条媒体必须同时出现在 manifest 和 ZIP 中，三处的路径、大小和 SHA-256 必须一致。

### 6.7 settings

```json
{
  "key": "performance-browse-preferences-v1",
  "value": {},
  "updatedAtMs": 1784201400000
}
```

v1 允许备份的 key：

- `performance-browse-preferences-v1`；
- `want-see-preferences-v1`；
- `imprint-preferences-v1`；
- `quick-add-preferences-v1`；
- `recordlive.theme-preference`；
- `recordlive.purchase-channels.v1`；
- `recordlive.friends.v1`；
- `recordlive.custom-companies.v1`。

恢复时每个 value 必须经过对应业务 normalizer，不直接信任任意 JSON。未知 key 忽略并显示兼容性警告，不写入数据库。

以下内容不得进入备份：

- 上次备份或恢复时间；
- 内部恢复点元数据；
- WebDAV 地址、账号和密码；
- API token、系统密钥、登录态、购买或权益凭证；
- 仅当前会话有效的 Tab、路由、弹窗和加载状态。

## 7. 一致性与恢复原子性

### 7.1 备份一致性

备份期间由 `DataOperationCoordinator` 阻止新的用户数据写入。SQLite 在同一个读快照中导出所有表；快照完成后仍保持写入锁，逐个验证数据库引用的媒体文件大小和 SHA-256，直到 ZIP 生成结束。

任一数据库引用媒体缺失或哈希不一致时，备份失败并指出异常媒体所属演出，不生成一个看似成功但无法完整恢复的文件。

### 7.2 两种恢复模式共用的原子性

覆盖和合并都不直接覆盖现有媒体文件：

1. 恢复计划需要的全部新媒体先写入新的 generation；
2. 每个文件关闭后重新计算大小和 SHA-256；
3. SQLite 在一个事务中执行完整的覆盖或合并计划；
4. 新增的 `media_assets.relative_path` 直接引用已经验证的新 generation；
5. 事务提交后，新数据库与新媒体同时成为有效状态；
6. 旧媒体只在提交成功后按“数据库无引用”规则延后清理。

如果事务回滚，新 generation 尚未被数据库引用，可以安全删除；旧数据库和旧媒体保持不变。提交成功后即使进程在清理前退出，也只会留下无引用旧文件，不会产生数据库引用缺失。

应用启动时扫描未完成操作：

- 删除数据库未引用且超过 24 小时的 restore generation；
- 保留数据库仍引用的 generation；
- 清理未完成的临时 ZIP 和解压目录；
- 不自动删除内部恢复点。

### 7.3 全部覆盖规则

“全部覆盖”按完整快照执行：

1. 删除 `performance_tag_links`、`performance_facets`、`performance_songs` 和 `media_assets`；
2. 删除全部 `performances`、`performance_categories` 和 `performance_tags`，包括软删除行；
3. 删除 v1 可备份设置，保留恢复点、上次操作时间等设备级操作元数据；
4. 按分类、标签、演出、关系、歌曲、媒体和设置顺序插入备份快照；
5. 备份中缺失的可备份设置恢复为应用默认值；
6. 提交后清理数据库不再引用的旧媒体。

空备份也是合法完整快照；用户确认后会得到无演出、无分类和无标签的状态。

### 7.4 合并恢复规则

“与本机合并”固定为**增量、本机优先、可重复执行**：

- 不删除任何本机当前可见实体；
- 不用备份标量字段覆盖同 UUID 的本机可见实体；
- 备份中的新实体写入本机；
- 本机软删除但备份中存在的同 UUID 实体会被恢复为可见；
- 多值关系取并集；
- 媒体只补齐本机缺失的类型；
- 本机已有设置优先，备份设置只填补缺失 key。

#### 分类与标签

每个备份分类或标签按以下顺序解析目标 ID：

1. 本机存在相同 UUID 的可见实体：复用本机实体；名称和排序保持本机值；
2. 本机存在规范化名称相同的可见实体：复用该本机 ID，并重写本轮备份关系映射；
3. 本机仅存在相同 UUID 的软删除实体，且没有同名可见实体：使用备份字段恢复该 UUID；
4. 以上都不存在：按备份 UUID 新增。

规范化名称只用于分类和标签：

```text
String.normalize('NFKC')
-> trim
-> 连续空白折叠为一个空格
-> String.toLowerCase()
```

如果某个备份名称在本机匹配到多个规范化同名实体，计划视为无法自动判定，合并不得开始，并提示用户先整理对应的重复分类或标签。

#### 演出

演出只按 UUID 判断身份：

- 本机没有该 UUID：完整新增备份演出及其关系、歌曲和媒体；
- 本机存在同 UUID 的软删除演出：使用备份标量字段恢复，并用备份关系和媒体替换该软删除行原有的子数据；
- 本机存在同 UUID 的可见演出：本机名称、时间、地点、金额、座位、评分、状态、分类、坐标、备注和 `created_at_ms` 保持不变；只有实际补齐关系、歌曲或媒体时才更新 `updated_at_ms`。

对于同 UUID 的可见演出，只执行安全补齐：

- 标签关系按映射后的 tag ID 取并集；
- facet 按 `kind + 规范化 value` 取并集，本机值保留，备份新增值追加到现有最大 `sortOrder` 后；
- 歌曲按下方“歌曲 ID 冲突”规则执行内容去重、保留 UUID 或确定性重映射；
- `poster`、`poster_thumb`、`ticket_original`、`ticket_thumb` 分别判断，本机已有该类型时保留本机，只导入缺失类型；
- 发生任何关系、歌曲或媒体补齐时，将该演出的 `updated_at_ms` 更新为本次合并时间。

两个 UUID 不同的演出即使名称、时间和地点相同也不会自动合并，因为同一演出可能被用户记录多次。恢复计划会用“规范化名称 + 开始时间 + 城市 + 场地”计算疑似重复数量，只作为确认页警告。

#### 媒体 ID 冲突

每个实际导入的媒体写入新的物理路径。媒体 UUID 未被本机使用时保留备份 UUID；如果 UUID 已被其它媒体占用，则生成新 UUID，并只在本轮恢复计划中重写 `media_assets.id` 和目标文件名。大小和 SHA-256 仍必须与备份 manifest 一致。

#### 歌曲 ID 冲突

歌曲没有其它外部引用，可以安全重映射：

- 目标演出已存在相同内容指纹的歌曲：无论 UUID 是否相同都跳过；
- 相同歌曲 UUID 已存在但属于其它演出或内容不同：为备份歌曲生成新 UUID；
- UUID 不存在：保留备份 UUID。

歌曲内容指规范化后的 `artistName + titles`。新 UUID 只存在于本轮计划，不修改备份源文件。

#### 设置

- 本机已有允许备份的 key：保留本机值；
- 本机缺失允许备份的 key：导入备份值并经过对应 normalizer；
- 未知或敏感 key：继续忽略；
- 上次备份、恢复、恢复点和当前会话元数据不参与合并。

#### 合并结果与幂等性

合并结果页至少显示：

- 新增演出数；
- 恢复的软删除演出数；
- 同 UUID 保留本机的演出数；
- 新增/复用/恢复的分类与标签数；
- 新增标签关系、facet 和歌曲数；
- 补齐媒体数与跳过媒体数；
- 新增设置数；
- 疑似重复演出数；
- 冲突和警告明细。

同一备份连续合并两次，第二次不得再次新增演出、分类、标签、关系、歌曲或媒体；除操作时间和结果日志外，业务状态必须保持不变。

### 7.5 SQLite 计划执行

加锁并确认 `planFingerprint` 后：

1. 再次确认数据库已完成全部 migration 且 foreign keys 开启；
2. 开启一个 SQLite 事务；
3. 覆盖模式按 7.3 的删除和插入顺序执行；
4. 合并模式先执行分类/标签映射与恢复，再执行演出新增/恢复，最后执行关系、歌曲、媒体和设置动作；
5. 合并模式除清理“被恢复的软删除演出”的旧子数据外，不执行删除；
6. 计划中每个动作使用明确的 `INSERT` 或带目标条件的 `UPDATE`，不得用 `INSERT OR IGNORE` 吞掉计划外冲突；
7. 提交前执行 `PRAGMA foreign_key_check`，返回任何行都抛错回滚；
8. 事务提交后记录不含用户数据正文的结果摘要和 `planFingerprint`；
9. Repository/Store 重新加载成功后才向用户显示完成。

重新加载失败不回滚已经提交的正确数据；页面进入“数据已恢复，请重新启动应用”的降级状态，并禁止继续编辑，避免旧内存状态再次写回数据库。

## 8. 校验与资源限制

在任何解压或数据库写入前完成：

1. 复制源 URI 到应用临时文件，同时限制压缩包大小；
2. 枚举 ZIP 中央目录；
3. 校验条目名称、数量、声明大小、加密标记和允许路径；
4. 读取并校验 manifest；
5. 只提取 manifest 声明的 data 和媒体；
6. 流式统计实际解压字节并计算 SHA-256；
7. 校验 data.json 字段、唯一键、枚举和引用关系；
8. 读取本机状态并生成覆盖或合并计划；
9. 按计划检查可用空间；
10. 生成预览，等待用户确认。

v1 上限：

| 项目 | 上限 |
|---|---:|
| 压缩包 | 2 GiB |
| ZIP 文件条目 | 20,002 |
| `manifest.json` | 1 MiB |
| `data.json` | 64 MiB |
| 单个媒体 | 512 MiB |
| 全部解压内容 | 8 GiB |

实际解压字节超过 manifest、ZIP 声明或上述上限时立即中止。空间预检至少预留：

```text
源 ZIP 临时副本
+ 恢复计划实际需要写入的媒体和 data 大小
+ 当前引用媒体总大小（内部恢复点的保守估算）
+ 256 MiB 安全余量
```

低于要求时在恢复模式确认前提示所需空间和当前可用空间。

## 9. 版本策略

- `schemaVersion` 是备份数据契约版本，不等同于 SQLite migration 版本；
- 版本只允许正整数递增；
- 当前应用只写出 v1；
- 未来低版本通过 `src/domain/backup/upgraders/` 中的纯函数逐级升级到当前内存模型；
- 不支持的更高版本只提示更新应用；
- 备份内的 `appVersion` 只用于说明和诊断，不作为唯一兼容性判断；
- 契约升级必须增加旧版升级、往返恢复、损坏文件和更高版本拒绝测试。

## 10. 实施切片

1. **M5.1 契约与设计（已完成）**：冻结本文件的范围、全部覆盖、合并冲突规则、容器、数据、校验、安全限制和 Android 平台边界；
2. **M5.2 快照与恢复计划（已完成）**：已实现 v1 domain 类型、data validator、当前状态读取、纯 `RestorePlanner`、设置迁移和覆盖/合并计划测试；
3. **M5.3 Android 文件能力（已完成代码与资源构建）**：已实现 UTS SAF/ZIP 网关、临时目录、受限解压、哈希验证和恶意 ZIP 基础防护；
4. **M5.4 手动备份（已完成代码与资源构建）**：已实现页面摘要、备份进度、系统新建文档和导出前回读校验；
5. **M5.5 双模式恢复（已完成代码、自动化与资源构建）**：已实现选择文件、模式与计划预览、内部恢复点、媒体 generation、SQLite 覆盖/合并事务和撤销恢复；备份生成完成后释放写锁再进入系统文件选择器，失败恢复立即删除本次未引用 generation，提交后的临时清理失败不会误报数据恢复失败，启动时清理超过 24 小时且未被数据库引用的 `restore-*` 与 `backup-work` 目录，页面卸载时解除待处理的 Activity Result 监听；
6. **M5.6 验收（进行中）**：纯领域自动化、H5 边界构建和 App 资源构建属于本轮范围；备份交互只在 Android 验证，Android 自定义基座和真机矩阵仍需用户另行授权。

## 11. 验收矩阵

自动化至少覆盖：

- 空数据、仅字典/设置、完整演出与媒体的备份；
- data 顶层字段、每类实体、金额、坐标、枚举、唯一键和外键校验；
- `..`、绝对路径、反斜线、重复路径、未知条目、加密 ZIP、大小欺骗和 ZIP bomb；
- data、媒体和 manifest 任一大小或哈希不一致；
- 更高版本拒绝和旧版本升级；
- 备份后恢复的逐字段往返一致性；
- 全部覆盖删除旧数据但保留设备级操作元数据；
- 合并新增、软删除恢复、同 UUID 本机优先、多值关系并集和缺失媒体补齐；
- 分类/标签同名映射、重复同名拒绝和备份关系 ID 重写；
- 媒体 UUID 冲突重映射；
- 歌曲 UUID 冲突跳过或重映射；
- 同一备份重复合并的幂等性；
- 疑似重复演出只警告、不自动合并；
- 恢复前点创建失败时拒绝执行任一模式；
- 媒体写入、SQLite 删除、插入、提交和重新加载各阶段的故障注入；
- 事务回滚后旧数据和旧媒体仍可读取；
- 提交后清理失败只留下无引用文件；
- 进程在恢复各阶段退出后的启动清理；
- 可备份设置恢复、未知设置忽略和敏感设置排除；
- H5 不注入备份服务、不显示入口且产物不包含 H5 备份模拟流程。

Android 自定义基座或真机至少验证：

- Android 系统新建/打开文档、取消和返回键；
- Downloads 与系统文件管理器中的备份和恢复；
- 低空间、大文件、后台切换和进程被系统回收；
- 应用卸载重装后从外部保留的备份文件恢复；
- SQLite、媒体和设置在重启后保持一致；
- 不申请全盘存储权限。

App 构建通过、H5 流程通过或纯单元测试通过都不能替代上述 Android 文件选择、ContentResolver、SQLite 和媒体真机验证。
