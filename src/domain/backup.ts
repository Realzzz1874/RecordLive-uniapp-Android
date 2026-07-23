export interface AndroidBackupFileEntry {
  path: string
  byteSize: number
  sha256: string
}

export const BACKUP_SETTING_KEYS = [
  'performance-browse-preferences-v1',
  'want-see-preferences-v1',
  'imprint-preferences-v1',
  'quick-add-preferences-v1',
  'recordlive.theme-preference',
  'recordlive.purchase-channels.v1',
  'recordlive.friends.v1',
  'recordlive.custom-companies.v1',
] as const

export type BackupSettingKey = typeof BACKUP_SETTING_KEYS[number]
export type BackupFacetKind = 'artist' | 'guest' | 'play' | 'channel' | 'friend' | 'company'
export type BackupMediaKind = 'poster' | 'poster_thumb' | 'ticket_original' | 'ticket_thumb'

export interface AndroidBackupPerformanceV1 {
  id: string
  name: string
  startedAtMs: number
  city: string
  venue: string
  remark: string
  ticketPriceAmount: string
  ticketPriceCurrency: string
  paidPriceAmount: string
  paidPriceCurrency: string
  otherCostAmount: string
  otherCostCurrency: string
  seat: string
  rating: number
  status: 0 | 1 | 2 | 3
  categoryId: string | null
  latitude: number | null
  longitude: number | null
  createdAtMs: number
  updatedAtMs: number
}

export interface AndroidBackupReferenceV1 {
  id: string
  name: string
  sortOrder: number
  createdAtMs: number
  updatedAtMs: number
}

export interface AndroidBackupPerformanceTagV1 {
  performanceId: string
  tagId: string
  createdAtMs: number
}

export interface AndroidBackupFacetV1 {
  performanceId: string
  kind: BackupFacetKind
  value: string
  sortOrder: number
}

export interface AndroidBackupSongV1 {
  id: string
  performanceId: string
  artistName: string
  titles: string[]
  createdAtMs: number
  updatedAtMs: number
}

export interface AndroidBackupMediaAssetV1 {
  id: string
  performanceId: string
  kind: BackupMediaKind
  archivePath: string
  mimeType: 'image/jpeg'
  byteSize: number
  sha256: string
  width: number | null
  height: number | null
  createdAtMs: number
}

export interface AndroidBackupSettingV1 {
  key: BackupSettingKey
  value: unknown
  updatedAtMs: number
}

export interface AndroidBackupDataV1 {
  performances: AndroidBackupPerformanceV1[]
  categories: AndroidBackupReferenceV1[]
  tags: AndroidBackupReferenceV1[]
  performanceTags: AndroidBackupPerformanceTagV1[]
  performanceFacets: AndroidBackupFacetV1[]
  songs: AndroidBackupSongV1[]
  mediaAssets: AndroidBackupMediaAssetV1[]
  settings: AndroidBackupSettingV1[]
}

export interface AndroidBackupManifestV1 {
  schemaVersion: 1
  backupKind: 'android-local'
  appVersion: string
  exportedAtMs: number
  dataFile: string
  files: AndroidBackupFileEntry[]
}

export function validateAndroidBackupManifest(
  input: unknown,
): AndroidBackupManifestV1 {
  if (!isRecord(input)) throw new Error('Backup manifest must be an object')
  if (input.schemaVersion !== 1) throw new Error('Unsupported backup schema version')
  if (input.backupKind !== 'android-local') throw new Error('Invalid backup kind')
  if (typeof input.appVersion !== 'string' || input.appVersion.trim() === '') {
    throw new Error('Backup app version is required')
  }
  if (
    typeof input.exportedAtMs !== 'number' ||
    !Number.isSafeInteger(input.exportedAtMs) ||
    input.exportedAtMs < 0
  ) {
    throw new Error('Invalid backup timestamp')
  }
  if (typeof input.dataFile !== 'string' || !isSafeRelativePath(input.dataFile)) {
    throw new Error('Invalid backup data file path')
  }
  if (input.dataFile !== 'data.json') throw new Error('Unsupported backup data file path')
  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error('Backup file list is required')
  }

  const paths = new Set<string>()
  const files = input.files.map((value, index) => validateFile(value, index, paths))
  if (!paths.has(input.dataFile)) {
    throw new Error('Backup data file is missing from file list')
  }
  for (const path of paths) {
    if (path !== 'data.json' && !/^media\/[^/]+\.jpg$/.test(path)) {
      throw new Error(`Unsupported backup file path: ${path}`)
    }
  }

  return {
    schemaVersion: 1,
    backupKind: 'android-local',
    appVersion: input.appVersion,
    exportedAtMs: input.exportedAtMs,
    dataFile: input.dataFile,
    files,
  }
}

export function validateAndroidBackupData(input: unknown): AndroidBackupDataV1 {
  if (!isRecord(input)) throw new Error('Backup data must be an object')
  const expectedKeys = [
    'performances',
    'categories',
    'tags',
    'performanceTags',
    'performanceFacets',
    'songs',
    'mediaAssets',
    'settings',
  ]
  for (const key of expectedKeys) {
    if (!Array.isArray(input[key])) throw new Error(`Backup data field ${key} must be an array`)
  }
  const expectedKeySet = new Set(expectedKeys)
  for (const key of Object.keys(input)) {
    if (!expectedKeySet.has(key)) throw new Error(`Unknown backup data field: ${key}`)
  }
  const performanceInput = input.performances as unknown[]
  const categoryInput = input.categories as unknown[]
  const tagInput = input.tags as unknown[]
  const performanceTagInput = input.performanceTags as unknown[]
  const facetInput = input.performanceFacets as unknown[]
  const songInput = input.songs as unknown[]
  const mediaInput = input.mediaAssets as unknown[]
  const settingInput = input.settings as unknown[]

  const categories = validateReferences(categoryInput, 'category')
  const tags = validateReferences(tagInput, 'tag')
  const categoryIds = new Set(categories.map(({ id }) => id))
  const tagIds = new Set(tags.map(({ id }) => id))
  const performances = validatePerformances(performanceInput, categoryIds)
  const performanceIds = new Set(performances.map(({ id }) => id))

  const performanceTags = uniqueBy(
    performanceTagInput.map((value, index) => {
      const row = requireRecord(value, `performance tag ${index}`)
      const performanceId = requireString(row.performanceId, `performance tag ${index} performanceId`)
      const tagId = requireString(row.tagId, `performance tag ${index} tagId`)
      if (!performanceIds.has(performanceId)) throw new Error(`Unknown performanceId: ${performanceId}`)
      if (!tagIds.has(tagId)) throw new Error(`Unknown tagId: ${tagId}`)
      return {
        performanceId,
        tagId,
        createdAtMs: requireTimestamp(row.createdAtMs, `performance tag ${index} createdAtMs`),
      }
    }),
    ({ performanceId, tagId }) => `${performanceId}\u0000${tagId}`,
    'performance tag',
  )

  const facetKinds = new Set<BackupFacetKind>(['artist', 'guest', 'play', 'channel', 'friend', 'company'])
  const performanceFacets = uniqueBy(
    facetInput.map((value, index) => {
      const row = requireRecord(value, `facet ${index}`)
      const performanceId = requireString(row.performanceId, `facet ${index} performanceId`)
      if (!performanceIds.has(performanceId)) throw new Error(`Unknown performanceId: ${performanceId}`)
      const kind = requireString(row.kind, `facet ${index} kind`) as BackupFacetKind
      if (!facetKinds.has(kind)) throw new Error(`Invalid facet kind: ${kind}`)
      return {
        performanceId,
        kind,
        value: requireTrimmedString(row.value, `facet ${index} value`),
        sortOrder: requireNonNegativeInteger(row.sortOrder, `facet ${index} sortOrder`),
      }
    }),
    ({ performanceId, kind, value }) => `${performanceId}\u0000${kind}\u0000${normalizeBackupName(value)}`,
    'facet',
  )

  const songs = uniqueBy(
    songInput.map((value, index) => {
      const row = requireRecord(value, `song ${index}`)
      const performanceId = requireString(row.performanceId, `song ${index} performanceId`)
      if (!performanceIds.has(performanceId)) throw new Error(`Unknown performanceId: ${performanceId}`)
      if (!Array.isArray(row.titles) || row.titles.some((title) => typeof title !== 'string')) {
        throw new Error(`Invalid song ${index} titles`)
      }
      return {
        id: requireTrimmedString(row.id, `song ${index} id`),
        performanceId,
        artistName: requireString(row.artistName, `song ${index} artistName`),
        titles: row.titles.map(String),
        createdAtMs: requireTimestamp(row.createdAtMs, `song ${index} createdAtMs`),
        updatedAtMs: requireTimestamp(row.updatedAtMs, `song ${index} updatedAtMs`),
      }
    }),
    ({ id }) => id,
    'song',
  )

  const mediaKinds = new Set<BackupMediaKind>(['poster', 'poster_thumb', 'ticket_original', 'ticket_thumb'])
  const mediaAssets = uniqueBy(
    mediaInput.map((value, index) => {
      const row = requireRecord(value, `media asset ${index}`)
      const performanceId = requireString(row.performanceId, `media asset ${index} performanceId`)
      if (!performanceIds.has(performanceId)) throw new Error(`Unknown performanceId: ${performanceId}`)
      const kind = requireString(row.kind, `media asset ${index} kind`) as BackupMediaKind
      if (!mediaKinds.has(kind)) throw new Error(`Invalid media kind: ${kind}`)
      const id = requireTrimmedString(row.id, `media asset ${index} id`)
      const archivePath = requireString(row.archivePath, `media asset ${index} archivePath`)
      if (archivePath !== `media/${id}.jpg` || !isSafeRelativePath(archivePath)) {
        throw new Error(`Invalid media archive path: ${archivePath}`)
      }
      if (row.mimeType !== 'image/jpeg') throw new Error(`Invalid media MIME type: ${String(row.mimeType)}`)
      return {
        id,
        performanceId,
        kind,
        archivePath,
        mimeType: 'image/jpeg' as const,
        byteSize: requireNonNegativeInteger(row.byteSize, `media asset ${index} byteSize`),
        sha256: requireHash(row.sha256, `media asset ${index} sha256`),
        width: requireNullableDimension(row.width, `media asset ${index} width`),
        height: requireNullableDimension(row.height, `media asset ${index} height`),
        createdAtMs: requireTimestamp(row.createdAtMs, `media asset ${index} createdAtMs`),
      }
    }),
    ({ id }) => id,
    'media asset',
  )
  uniqueBy(mediaAssets, ({ performanceId, kind }) => `${performanceId}\u0000${kind}`, 'performance media kind')

  const allowedSettingKeys = new Set<string>(BACKUP_SETTING_KEYS)
  const settings = uniqueBy(
    settingInput.flatMap((value, index) => {
      const row = requireRecord(value, `setting ${index}`)
      const key = requireString(row.key, `setting ${index} key`)
      if (!allowedSettingKeys.has(key)) return []
      return [{
        key: key as BackupSettingKey,
        value: cloneJsonValue(row.value),
        updatedAtMs: requireTimestamp(row.updatedAtMs, `setting ${index} updatedAtMs`),
      }]
    }),
    ({ key }) => key,
    'setting',
  )

  return sortBackupData({
    performances,
    categories,
    tags,
    performanceTags,
    performanceFacets,
    songs,
    mediaAssets,
    settings,
  })
}

export function sortBackupData(data: AndroidBackupDataV1): AndroidBackupDataV1 {
  const compare = (a: string, b: string) => a.localeCompare(b)
  return {
    performances: [...data.performances].sort((a, b) => compare(a.id, b.id)),
    categories: [...data.categories].sort((a, b) => compare(a.id, b.id)),
    tags: [...data.tags].sort((a, b) => compare(a.id, b.id)),
    performanceTags: [...data.performanceTags].sort((a, b) =>
      compare(`${a.performanceId}\u0000${a.tagId}`, `${b.performanceId}\u0000${b.tagId}`)),
    performanceFacets: [...data.performanceFacets].sort((a, b) =>
      compare(`${a.performanceId}\u0000${a.kind}\u0000${String(a.sortOrder).padStart(10, '0')}\u0000${a.value}`,
        `${b.performanceId}\u0000${b.kind}\u0000${String(b.sortOrder).padStart(10, '0')}\u0000${b.value}`)),
    songs: [...data.songs].sort((a, b) => compare(a.id, b.id)),
    mediaAssets: [...data.mediaAssets].sort((a, b) => compare(a.id, b.id)),
    settings: [...data.settings].sort((a, b) => compare(a.key, b.key)),
  }
}

export function normalizeBackupName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
}

function validateFile(
  value: unknown,
  index: number,
  paths: Set<string>,
): AndroidBackupFileEntry {
  if (!isRecord(value)) throw new Error(`Backup file at index ${index} is invalid`)
  if (typeof value.path !== 'string' || !isSafeRelativePath(value.path)) {
    throw new Error(`Backup file path at index ${index} is invalid`)
  }
  if (paths.has(value.path)) throw new Error(`Duplicate backup file path: ${value.path}`)
  if (
    typeof value.byteSize !== 'number' ||
    !Number.isSafeInteger(value.byteSize) ||
    value.byteSize < 0
  ) {
    throw new Error(`Backup file size at index ${index} is invalid`)
  }
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sha256)) {
    throw new Error(`Backup file hash at index ${index} is invalid`)
  }

  paths.add(value.path)
  return {
    path: value.path,
    byteSize: value.byteSize,
    sha256: value.sha256.toLowerCase(),
  }
}

function isSafeRelativePath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false
  return path.split('/').every((segment) => segment !== '' && segment !== '..' && segment !== '.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${label}`)
  return value
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}`)
  return value
}

function requireTrimmedString(value: unknown, label: string): string {
  const string = requireString(value, label).trim()
  if (!string) throw new Error(`Invalid ${label}`)
  return string
}

function requireNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

function requireTimestamp(value: unknown, label: string): number {
  return requireNonNegativeInteger(value, label)
}

function requireNullableDimension(value: unknown, label: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

function requireHash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value.toLowerCase()
}

function validateReferences(input: unknown[], label: string): AndroidBackupReferenceV1[] {
  const rows = uniqueBy(input.map((value, index) => {
    const row = requireRecord(value, `${label} ${index}`)
    return {
      id: requireTrimmedString(row.id, `${label} ${index} id`),
      name: requireTrimmedString(row.name, `${label} ${index} name`),
      sortOrder: requireNonNegativeInteger(row.sortOrder, `${label} ${index} sortOrder`),
      createdAtMs: requireTimestamp(row.createdAtMs, `${label} ${index} createdAtMs`),
      updatedAtMs: requireTimestamp(row.updatedAtMs, `${label} ${index} updatedAtMs`),
    }
  }), ({ id }) => id, label)
  uniqueBy(rows, ({ name }) => normalizeBackupName(name), `${label} normalized name`)
  return rows
}

function validatePerformances(
  input: unknown[],
  categoryIds: Set<string>,
): AndroidBackupPerformanceV1[] {
  return uniqueBy(input.map((value, index) => {
    const row = requireRecord(value, `performance ${index}`)
    const categoryId = row.categoryId === null
      ? null
      : requireString(row.categoryId, `performance ${index} categoryId`)
    if (categoryId !== null && !categoryIds.has(categoryId)) {
      throw new Error(`Unknown categoryId: ${categoryId}`)
    }
    const latitude = row.latitude === null ? null : requireFiniteNumber(row.latitude, `performance ${index} latitude`)
    const longitude = row.longitude === null ? null : requireFiniteNumber(row.longitude, `performance ${index} longitude`)
    if ((latitude === null) !== (longitude === null)) {
      throw new Error(`Performance ${index} coordinate must be complete`)
    }
    const status = requireNonNegativeInteger(row.status, `performance ${index} status`)
    if (status > 3) throw new Error(`Invalid performance ${index} status`)
    const rating = requireFiniteNumber(row.rating, `performance ${index} rating`)
    if (rating < 0 || rating > 5) throw new Error(`Invalid performance ${index} rating`)
    return {
      id: requireTrimmedString(row.id, `performance ${index} id`),
      name: requireTrimmedString(row.name, `performance ${index} name`),
      startedAtMs: requireTimestamp(row.startedAtMs, `performance ${index} startedAtMs`),
      city: requireString(row.city, `performance ${index} city`),
      venue: requireString(row.venue, `performance ${index} venue`),
      remark: requireString(row.remark, `performance ${index} remark`),
      ticketPriceAmount: requireMoney(row.ticketPriceAmount, `performance ${index} ticketPriceAmount`),
      ticketPriceCurrency: requireCurrency(row.ticketPriceCurrency, `performance ${index} ticketPriceCurrency`),
      paidPriceAmount: requireMoney(row.paidPriceAmount, `performance ${index} paidPriceAmount`),
      paidPriceCurrency: requireCurrency(row.paidPriceCurrency, `performance ${index} paidPriceCurrency`),
      otherCostAmount: requireMoney(row.otherCostAmount, `performance ${index} otherCostAmount`),
      otherCostCurrency: requireCurrency(row.otherCostCurrency, `performance ${index} otherCostCurrency`),
      seat: requireString(row.seat, `performance ${index} seat`),
      rating,
      status: status as 0 | 1 | 2 | 3,
      categoryId,
      latitude,
      longitude,
      createdAtMs: requireTimestamp(row.createdAtMs, `performance ${index} createdAtMs`),
      updatedAtMs: requireTimestamp(row.updatedAtMs, `performance ${index} updatedAtMs`),
    }
  }), ({ id }) => id, 'performance')
}

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${label}`)
  return value
}

function requireMoney(value: unknown, label: string): string {
  const string = requireString(value, label)
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(string)) throw new Error(`Invalid ${label}`)
  return string
}

function requireCurrency(value: unknown, label: string): string {
  const string = requireString(value, label)
  if (!/^[A-Z]{3}$/.test(string)) throw new Error(`Invalid ${label}`)
  return string
}

function uniqueBy<T>(values: T[], keyOf: (value: T) => string, label: string): T[] {
  const keys = new Set<string>()
  for (const value of values) {
    const key = keyOf(value)
    if (keys.has(key)) throw new Error(`Duplicate ${label}: ${key}`)
    keys.add(key)
  }
  return values
}

function cloneJsonValue(value: unknown): unknown {
  if (value === undefined) throw new Error('Setting value is required')
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch {
    throw new Error('Setting value must be JSON serializable')
  }
}
