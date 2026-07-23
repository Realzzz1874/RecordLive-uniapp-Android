import {
  normalizeBackupName,
  sortBackupData,
  type AndroidBackupDataV1,
  type AndroidBackupMediaAssetV1,
  type AndroidBackupReferenceV1,
  type AndroidBackupSongV1,
} from './backup'

export type RestoreMode = 'replace-all' | 'merge-local-first'

export interface RestorePlanContext {
  operationId: string
  appliedAtMs: number
}

export interface CurrentRestoreState {
  data: AndroidBackupDataV1
  deletedCategoryIds: string[]
  deletedTagIds: string[]
  deletedPerformanceIds: string[]
  mediaRelativePaths: Record<string, string>
}

export type RestoreMediaSource =
  | { assetId: string; source: 'current'; relativePath: string }
  | { assetId: string; source: 'backup'; archivePath: string }

export interface RestorePlanSummary {
  performancesAdded: number
  performancesReused: number
  performancesRevived: number
  referencesAdded: number
  referencesReused: number
  referencesRevived: number
  relationshipsAdded: number
  songsAdded: number
  mediaAdded: number
  settingsAdded: number
  conflictsSkipped: number
  suspectedDuplicates: number
}

export interface RestorePlan {
  mode: RestoreMode
  operationId: string
  appliedAtMs: number
  data: AndroidBackupDataV1
  mediaSources: RestoreMediaSource[]
  summary: RestorePlanSummary
  warnings: string[]
  planFingerprint: string
}

export function planRestore(
  current: CurrentRestoreState,
  backup: AndroidBackupDataV1,
  mode: RestoreMode,
  context: RestorePlanContext,
): RestorePlan {
  assertContext(context)
  const result = mode === 'replace-all'
    ? planReplace(backup, context)
    : planMerge(current, backup, context)
  const fingerprintInput = {
    mode: result.mode,
    operationId: result.operationId,
    appliedAtMs: result.appliedAtMs,
    data: result.data,
    mediaSources: result.mediaSources,
    summary: result.summary,
    warnings: result.warnings,
  }
  return {
    ...result,
    planFingerprint: sha256(stableJson(fingerprintInput)),
  }
}

function planReplace(
  backup: AndroidBackupDataV1,
  context: RestorePlanContext,
): Omit<RestorePlan, 'planFingerprint'> {
  const data = sortBackupData(cloneData(backup))
  return {
    mode: 'replace-all',
    ...context,
    data,
    mediaSources: data.mediaAssets.map(({ id, archivePath }) => ({
      assetId: id,
      source: 'backup' as const,
      archivePath,
    })),
    summary: {
      performancesAdded: data.performances.length,
      performancesReused: 0,
      performancesRevived: 0,
      referencesAdded: data.categories.length + data.tags.length,
      referencesReused: 0,
      referencesRevived: 0,
      relationshipsAdded: data.performanceTags.length + data.performanceFacets.length,
      songsAdded: data.songs.length,
      mediaAdded: data.mediaAssets.length,
      settingsAdded: data.settings.length,
      conflictsSkipped: 0,
      suspectedDuplicates: 0,
    },
    warnings: [],
  }
}

function planMerge(
  current: CurrentRestoreState,
  backup: AndroidBackupDataV1,
  context: RestorePlanContext,
): Omit<RestorePlan, 'planFingerprint'> {
  const data = cloneData(current.data)
  const summary = emptySummary()
  const warnings: string[] = []
  const categoryMap = mergeReferences(
    data.categories,
    backup.categories,
    new Set(current.deletedCategoryIds),
    'category',
    summary,
  )
  const tagMap = mergeReferences(
    data.tags,
    backup.tags,
    new Set(current.deletedTagIds),
    'tag',
    summary,
  )

  const performanceById = new Map(data.performances.map((item) => [item.id, item]))
  const deletedPerformanceIds = new Set(current.deletedPerformanceIds)
  const currentPerformanceIds = new Set(data.performances.map(({ id }) => id))
  const mediaSources = new Map<string, RestoreMediaSource>(
    data.mediaAssets.map(({ id }) => [
      id,
      {
        assetId: id,
        source: 'current' as const,
        relativePath: requiredCurrentMediaPath(current, id),
      },
    ]),
  )

  for (const source of backup.performances) {
    const existing = performanceById.get(source.id)
    const isRevive = !existing && deletedPerformanceIds.has(source.id)
    if (!existing) {
      const item = {
        ...source,
        categoryId: source.categoryId === null ? null : categoryMap.get(source.categoryId) ?? null,
      }
      data.performances.push(item)
      performanceById.set(item.id, item)
      if (isRevive) summary.performancesRevived += 1
      else summary.performancesAdded += 1
    } else {
      summary.performancesReused += 1
      summary.conflictsSkipped += countScalarDifferences(existing, source)
    }

    if (!currentPerformanceIds.has(source.id) && hasSuspectedDuplicate(current.data, source)) {
      summary.suspectedDuplicates += 1
    }
  }

  const tagLinks = new Set(data.performanceTags.map(({ performanceId, tagId }) => pair(performanceId, tagId)))
  for (const link of backup.performanceTags) {
    const tagId = tagMap.get(link.tagId)
    if (!tagId) continue
    const key = pair(link.performanceId, tagId)
    if (tagLinks.has(key)) continue
    data.performanceTags.push({ ...link, tagId })
    tagLinks.add(key)
    summary.relationshipsAdded += 1
    touchPerformance(data, link.performanceId, context.appliedAtMs)
  }

  const facetKeys = new Set(data.performanceFacets.map(facetKey))
  const nextFacetOrders = new Map<string, number>()
  for (const facet of data.performanceFacets) {
    const key = pair(facet.performanceId, facet.kind)
    nextFacetOrders.set(key, Math.max(nextFacetOrders.get(key) ?? 0, facet.sortOrder + 1))
  }
  for (const facet of backup.performanceFacets) {
    const key = facetKey(facet)
    if (facetKeys.has(key)) continue
    const groupKey = pair(facet.performanceId, facet.kind)
    const sortOrder = nextFacetOrders.get(groupKey) ?? 0
    data.performanceFacets.push({ ...facet, sortOrder })
    nextFacetOrders.set(groupKey, sortOrder + 1)
    facetKeys.add(key)
    summary.relationshipsAdded += 1
    touchPerformance(data, facet.performanceId, context.appliedAtMs)
  }

  const songIds = new Set(data.songs.map(({ id }) => id))
  const songContent = new Set(data.songs.map(songContentKey))
  for (const song of backup.songs) {
    const contentKey = songContentKey(song)
    if (songContent.has(contentKey)) continue
    let target = { ...song, titles: [...song.titles] }
    if (songIds.has(target.id)) {
      target = {
        ...target,
        id: deterministicId(context.operationId, 'song', target.id),
      }
    }
    if (songIds.has(target.id)) {
      throw new Error(`Unable to resolve song ID conflict: ${song.id}`)
    }
    data.songs.push(target)
    songIds.add(target.id)
    songContent.add(contentKey)
    summary.songsAdded += 1
    touchPerformance(data, target.performanceId, context.appliedAtMs)
  }

  const mediaIds = new Set(data.mediaAssets.map(({ id }) => id))
  const performanceMediaKinds = new Set(data.mediaAssets.map(({ performanceId, kind }) => pair(performanceId, kind)))
  for (const asset of backup.mediaAssets) {
    const kindKey = pair(asset.performanceId, asset.kind)
    if (performanceMediaKinds.has(kindKey)) continue
    let target: AndroidBackupMediaAssetV1 = { ...asset }
    if (mediaIds.has(target.id)) {
      const targetId = deterministicId(context.operationId, 'media', target.id)
      target = {
        ...target,
        id: targetId,
        archivePath: `media/${targetId}.jpg`,
      }
    }
    if (mediaIds.has(target.id)) {
      throw new Error(`Unable to resolve media ID conflict: ${asset.id}`)
    }
    data.mediaAssets.push(target)
    mediaSources.set(target.id, {
      assetId: target.id,
      source: 'backup',
      archivePath: asset.archivePath,
    })
    mediaIds.add(target.id)
    performanceMediaKinds.add(kindKey)
    summary.mediaAdded += 1
    touchPerformance(data, target.performanceId, context.appliedAtMs)
  }

  const settingKeys = new Set(data.settings.map(({ key }) => key))
  for (const setting of backup.settings) {
    if (settingKeys.has(setting.key)) continue
    data.settings.push(clone(setting))
    settingKeys.add(setting.key)
    summary.settingsAdded += 1
  }

  if (summary.suspectedDuplicates > 0) {
    warnings.push(`发现 ${summary.suspectedDuplicates} 条名称、时间和地点相似但 UUID 不同的演出，已分别保留`)
  }

  return {
    mode: 'merge-local-first',
    ...context,
    data: sortBackupData(data),
    mediaSources: [...mediaSources.values()].sort((a, b) => a.assetId.localeCompare(b.assetId)),
    summary,
    warnings,
  }
}

function mergeReferences(
  target: AndroidBackupReferenceV1[],
  incoming: AndroidBackupReferenceV1[],
  deletedIds: Set<string>,
  kind: 'category' | 'tag',
  summary: RestorePlanSummary,
): Map<string, string> {
  const byId = new Map(target.map((item) => [item.id, item]))
  const byName = new Map<string, AndroidBackupReferenceV1[]>()
  for (const item of target) {
    const key = normalizeBackupName(item.name)
    byName.set(key, [...(byName.get(key) ?? []), item])
  }
  for (const [name, matches] of byName) {
    if (matches.length > 1) {
      throw new Error(`本机存在多个规范化名称相同的${kind === 'category' ? '分类' : '标签'}：${name}`)
    }
  }

  const idMap = new Map<string, string>()
  for (const source of incoming) {
    const sameId = byId.get(source.id)
    if (sameId) {
      idMap.set(source.id, sameId.id)
      summary.referencesReused += 1
      continue
    }
    const sameName = byName.get(normalizeBackupName(source.name))?.[0]
    if (sameName) {
      idMap.set(source.id, sameName.id)
      summary.referencesReused += 1
      continue
    }
    const item = clone(source)
    target.push(item)
    byId.set(item.id, item)
    byName.set(normalizeBackupName(item.name), [item])
    idMap.set(source.id, item.id)
    if (deletedIds.has(source.id)) summary.referencesRevived += 1
    else summary.referencesAdded += 1
  }
  return idMap
}

function countScalarDifferences(
  current: AndroidBackupDataV1['performances'][number],
  backup: AndroidBackupDataV1['performances'][number],
): number {
  const ignored = new Set(['id', 'updatedAtMs'])
  return Object.keys(current).filter((key) =>
    !ignored.has(key) &&
    JSON.stringify(current[key as keyof typeof current]) !== JSON.stringify(backup[key as keyof typeof backup]),
  ).length
}

function hasSuspectedDuplicate(
  data: AndroidBackupDataV1,
  source: AndroidBackupDataV1['performances'][number],
): boolean {
  const key = suspectedDuplicateKey(source)
  return data.performances.some((item) => item.id !== source.id && suspectedDuplicateKey(item) === key)
}

function suspectedDuplicateKey(item: AndroidBackupDataV1['performances'][number]): string {
  return [
    normalizeBackupName(item.name),
    String(item.startedAtMs),
    normalizeBackupName(item.city),
    normalizeBackupName(item.venue),
  ].join('\u0000')
}

function songContentKey(song: AndroidBackupSongV1): string {
  return [
    song.performanceId,
    normalizeBackupName(song.artistName),
    ...song.titles.map(normalizeBackupName),
  ].join('\u0000')
}

function facetKey(facet: AndroidBackupDataV1['performanceFacets'][number]): string {
  return [facet.performanceId, facet.kind, normalizeBackupName(facet.value)].join('\u0000')
}

function touchPerformance(data: AndroidBackupDataV1, id: string, timestamp: number): void {
  const performance = data.performances.find((item) => item.id === id)
  if (performance) performance.updatedAtMs = timestamp
}

function pair(a: string, b: string): string {
  return `${a}\u0000${b}`
}

function requiredCurrentMediaPath(current: CurrentRestoreState, id: string): string {
  const value = current.mediaRelativePaths[id]
  if (!value) throw new Error(`Missing current media path: ${id}`)
  return value
}

function deterministicId(operationId: string, entityKind: string, sourceId: string): string {
  const hash = sha256(`${operationId}\u0000${entityKind}\u0000${sourceId}`)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function emptySummary(): RestorePlanSummary {
  return {
    performancesAdded: 0,
    performancesReused: 0,
    performancesRevived: 0,
    referencesAdded: 0,
    referencesReused: 0,
    referencesRevived: 0,
    relationshipsAdded: 0,
    songsAdded: 0,
    mediaAdded: 0,
    settingsAdded: 0,
    conflictsSkipped: 0,
    suspectedDuplicates: 0,
  }
}

function assertContext(context: RestorePlanContext): void {
  if (!context.operationId.trim()) throw new Error('Restore operation ID is required')
  if (!Number.isSafeInteger(context.appliedAtMs) || context.appliedAtMs < 0) {
    throw new Error('Restore timestamp is invalid')
  }
}

function cloneData(data: AndroidBackupDataV1): AndroidBackupDataV1 {
  return clone(data)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

// Compact synchronous SHA-256 keeps restore planning pure in both App and H5 runtimes.
function sha256(message: string): string {
  const bytes = encodeUtf8(message)
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 4, bitLength >>> 0)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const k = SHA256_CONSTANTS
  const w = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15]
      const y = w[i - 2]
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3)
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + s1 + ch + k[i] + w[i]) >>> 0
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
  return [...h].map((value) => value.toString(16).padStart(8, '0')).join('')
}

function encodeUtf8(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length * 3)
  let offset = 0
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index)
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00)
        index += 1
      } else {
        codePoint = 0xfffd
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd
    }

    if (codePoint <= 0x7f) {
      bytes[offset] = codePoint
      offset += 1
    } else if (codePoint <= 0x7ff) {
      bytes[offset] = 0xc0 | (codePoint >>> 6)
      bytes[offset + 1] = 0x80 | (codePoint & 0x3f)
      offset += 2
    } else if (codePoint <= 0xffff) {
      bytes[offset] = 0xe0 | (codePoint >>> 12)
      bytes[offset + 1] = 0x80 | ((codePoint >>> 6) & 0x3f)
      bytes[offset + 2] = 0x80 | (codePoint & 0x3f)
      offset += 3
    } else {
      bytes[offset] = 0xf0 | (codePoint >>> 18)
      bytes[offset + 1] = 0x80 | ((codePoint >>> 12) & 0x3f)
      bytes[offset + 2] = 0x80 | ((codePoint >>> 6) & 0x3f)
      bytes[offset + 3] = 0x80 | (codePoint & 0x3f)
      offset += 4
    }
  }
  return bytes.slice(0, offset)
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count))
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])
