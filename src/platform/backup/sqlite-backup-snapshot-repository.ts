import {
  BACKUP_SETTING_KEYS,
  sortBackupData,
  type AndroidBackupDataV1,
  type AndroidBackupSettingV1,
} from '@/domain/backup'
import { normalizeBackupSettingValue } from '@/domain/backup-settings'
import type {
  CurrentRestoreState,
  RestorePlan,
} from '@/domain/backup-restore-plan'
import type { BackupSnapshotRepository } from '@/features/backup/repository'
import type { DatabaseDriver, DatabaseRow } from '@/platform/database/driver'
import {
  sqlInteger,
  sqlNullableText,
  sqlNumber,
  sqlOptionalNumber,
  sqlText,
} from '@/platform/database/sql-values'

type Row = DatabaseRow

export class SQLiteBackupSnapshotRepository implements BackupSnapshotRepository {
  constructor(private readonly driver: DatabaseDriver) {}

  async exportSnapshot(): Promise<AndroidBackupDataV1> {
    return this.driver.transaction(() => this.readVisibleData())
  }

  async loadRestoreState(): Promise<CurrentRestoreState> {
    return this.driver.transaction(async () => {
      const [data, deletedCategories, deletedTags, deletedPerformances, mediaRows] = await Promise.all([
        this.readVisibleData(),
        this.driver.query<Row>('SELECT id FROM performance_categories WHERE deleted_at_ms IS NOT NULL ORDER BY id'),
        this.driver.query<Row>('SELECT id FROM performance_tags WHERE deleted_at_ms IS NOT NULL ORDER BY id'),
        this.driver.query<Row>('SELECT id FROM performances WHERE deleted_at_ms IS NOT NULL ORDER BY id'),
        this.driver.query<Row>('SELECT id, relative_path FROM media_assets ORDER BY id'),
      ])
      return {
        data,
        deletedCategoryIds: deletedCategories.map(({ id }) => String(id)),
        deletedTagIds: deletedTags.map(({ id }) => String(id)),
        deletedPerformanceIds: deletedPerformances.map(({ id }) => String(id)),
        mediaRelativePaths: Object.fromEntries(
          mediaRows.map(({ id, relative_path }) => [String(id), String(relative_path)]),
        ),
      }
    })
  }

  async applyRestorePlan(
    plan: RestorePlan,
    stagedMediaPaths: Record<string, string>,
  ): Promise<void> {
    const mediaPaths = new Map<string, string>()
    for (const source of plan.mediaSources) {
      const path = source.source === 'current'
        ? source.relativePath
        : stagedMediaPaths[source.assetId]
      if (!path) throw new Error(`恢复媒体尚未准备完成：${source.assetId}`)
      mediaPaths.set(source.assetId, path)
    }

    await this.driver.transaction(async () => {
      const statements: string[] = [
        'DELETE FROM performance_tag_links',
        'DELETE FROM performance_facets',
        'DELETE FROM performance_songs',
        'DELETE FROM media_assets',
        'DELETE FROM performances',
        'DELETE FROM performance_categories',
        'DELETE FROM performance_tags',
        `DELETE FROM app_settings WHERE key IN (${BACKUP_SETTING_KEYS.map(sqlText).join(', ')})`,
      ]
      statements.push(
        ...plan.data.categories.map((item) => `
          INSERT INTO performance_categories(id, name, sort_order, created_at_ms, updated_at_ms, deleted_at_ms)
          VALUES (${sqlText(item.id)}, ${sqlText(item.name)}, ${sqlInteger(item.sortOrder)}, ${sqlInteger(item.createdAtMs)}, ${sqlInteger(item.updatedAtMs)}, NULL)
        `.trim()),
        ...plan.data.tags.map((item) => `
          INSERT INTO performance_tags(id, name, sort_order, created_at_ms, updated_at_ms, deleted_at_ms)
          VALUES (${sqlText(item.id)}, ${sqlText(item.name)}, ${sqlInteger(item.sortOrder)}, ${sqlInteger(item.createdAtMs)}, ${sqlInteger(item.updatedAtMs)}, NULL)
        `.trim()),
        ...plan.data.performances.map((item) => `
          INSERT INTO performances(
            id, name, started_at_ms, city, venue, remark,
            ticket_price_amount, ticket_price_currency,
            paid_price_amount, paid_price_currency,
            other_cost_amount, other_cost_currency,
            seat, rating, status, category_id, latitude, longitude,
            created_at_ms, updated_at_ms, deleted_at_ms
          ) VALUES (
            ${sqlText(item.id)}, ${sqlText(item.name)}, ${sqlInteger(item.startedAtMs)},
            ${sqlText(item.city)}, ${sqlText(item.venue)}, ${sqlText(item.remark)},
            ${sqlText(item.ticketPriceAmount)}, ${sqlText(item.ticketPriceCurrency)},
            ${sqlText(item.paidPriceAmount)}, ${sqlText(item.paidPriceCurrency)},
            ${sqlText(item.otherCostAmount)}, ${sqlText(item.otherCostCurrency)},
            ${sqlText(item.seat)}, ${sqlNumber(item.rating)}, ${sqlInteger(item.status)},
            ${sqlNullableText(item.categoryId)},
            ${sqlOptionalNumber(item.latitude, 'latitude')},
            ${sqlOptionalNumber(item.longitude, 'longitude')},
            ${sqlInteger(item.createdAtMs)}, ${sqlInteger(item.updatedAtMs)}, NULL
          )
        `.trim()),
        ...plan.data.performanceTags.map((item) => `
          INSERT INTO performance_tag_links(performance_id, tag_id, created_at_ms)
          VALUES (${sqlText(item.performanceId)}, ${sqlText(item.tagId)}, ${sqlInteger(item.createdAtMs)})
        `.trim()),
        ...plan.data.performanceFacets.map((item) => `
          INSERT INTO performance_facets(performance_id, kind, value, sort_order)
          VALUES (${sqlText(item.performanceId)}, ${sqlText(item.kind)}, ${sqlText(item.value)}, ${sqlInteger(item.sortOrder)})
        `.trim()),
        ...plan.data.songs.map((item) => `
          INSERT INTO performance_songs(id, performance_id, artist_name, titles_json, created_at_ms, updated_at_ms)
          VALUES (
            ${sqlText(item.id)}, ${sqlText(item.performanceId)}, ${sqlText(item.artistName)},
            ${sqlText(JSON.stringify(item.titles))}, ${sqlInteger(item.createdAtMs)}, ${sqlInteger(item.updatedAtMs)}
          )
        `.trim()),
        ...plan.data.mediaAssets.map((item) => `
          INSERT INTO media_assets(
            id, performance_id, kind, relative_path, mime_type,
            byte_size, sha256, width, height, created_at_ms
          ) VALUES (
            ${sqlText(item.id)}, ${sqlText(item.performanceId)}, ${sqlText(item.kind)},
            ${sqlText(requiredMediaPath(mediaPaths, item.id))}, ${sqlText(item.mimeType)},
            ${sqlInteger(item.byteSize)}, ${sqlText(item.sha256)},
            ${sqlOptionalNumber(item.width, 'media width')},
            ${sqlOptionalNumber(item.height, 'media height')},
            ${sqlInteger(item.createdAtMs)}
          )
        `.trim()),
        ...plan.data.settings.map((item) => `
          INSERT INTO app_settings(key, value_json, updated_at_ms)
          VALUES (
            ${sqlText(item.key)},
            ${sqlText(JSON.stringify(normalizeBackupSettingValue(item.key, item.value)))},
            ${sqlInteger(item.updatedAtMs)}
          )
        `.trim()),
      )
      await this.driver.execute(statements)
      const violations = await this.driver.query<Row>('PRAGMA foreign_key_check')
      if (violations.length > 0) throw new Error('恢复后的数据库引用校验失败')
    })
  }

  private async readVisibleData(): Promise<AndroidBackupDataV1> {
    const [
      performances,
      categories,
      tags,
      performanceTags,
      performanceFacets,
      songs,
      mediaAssets,
      settings,
    ] = await Promise.all([
      this.driver.query<Row>(`
        SELECT id, name, started_at_ms, city, venue, remark,
          ticket_price_amount, ticket_price_currency,
          paid_price_amount, paid_price_currency,
          other_cost_amount, other_cost_currency,
          seat, rating, status, category_id, latitude, longitude,
          created_at_ms, updated_at_ms
        FROM performances WHERE deleted_at_ms IS NULL ORDER BY id
      `),
      this.driver.query<Row>(`
        SELECT id, name, sort_order, created_at_ms, updated_at_ms
        FROM performance_categories WHERE deleted_at_ms IS NULL ORDER BY id
      `),
      this.driver.query<Row>(`
        SELECT id, name, sort_order, created_at_ms, updated_at_ms
        FROM performance_tags WHERE deleted_at_ms IS NULL ORDER BY id
      `),
      this.driver.query<Row>(`
        SELECT l.performance_id, l.tag_id, l.created_at_ms
        FROM performance_tag_links l
        JOIN performances p ON p.id = l.performance_id AND p.deleted_at_ms IS NULL
        JOIN performance_tags t ON t.id = l.tag_id AND t.deleted_at_ms IS NULL
        ORDER BY l.performance_id, l.tag_id
      `),
      this.driver.query<Row>(`
        SELECT f.performance_id, f.kind, f.value, f.sort_order
        FROM performance_facets f
        JOIN performances p ON p.id = f.performance_id AND p.deleted_at_ms IS NULL
        ORDER BY f.performance_id, f.kind, f.sort_order, f.value
      `),
      this.driver.query<Row>(`
        SELECT s.id, s.performance_id, s.artist_name, s.titles_json, s.created_at_ms, s.updated_at_ms
        FROM performance_songs s
        JOIN performances p ON p.id = s.performance_id AND p.deleted_at_ms IS NULL
        ORDER BY s.id
      `),
      this.driver.query<Row>(`
        SELECT m.id, m.performance_id, m.kind, m.mime_type, m.byte_size, m.sha256,
          m.width, m.height, m.created_at_ms
        FROM media_assets m
        JOIN performances p ON p.id = m.performance_id AND p.deleted_at_ms IS NULL
        ORDER BY m.id
      `),
      this.driver.query<Row>(`
        SELECT key, value_json, updated_at_ms FROM app_settings
        WHERE key IN (${BACKUP_SETTING_KEYS.map(sqlText).join(', ')})
        ORDER BY key
      `),
    ])

    return sortBackupData({
      performances: performances.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        startedAtMs: Number(row.started_at_ms),
        city: String(row.city),
        venue: String(row.venue),
        remark: String(row.remark),
        ticketPriceAmount: String(row.ticket_price_amount),
        ticketPriceCurrency: String(row.ticket_price_currency),
        paidPriceAmount: String(row.paid_price_amount),
        paidPriceCurrency: String(row.paid_price_currency),
        otherCostAmount: String(row.other_cost_amount),
        otherCostCurrency: String(row.other_cost_currency),
        seat: String(row.seat),
        rating: Number(row.rating),
        status: Number(row.status) as 0 | 1 | 2 | 3,
        categoryId: row.category_id === null ? null : String(row.category_id),
        latitude: nullableNumber(row.latitude),
        longitude: nullableNumber(row.longitude),
        createdAtMs: Number(row.created_at_ms),
        updatedAtMs: Number(row.updated_at_ms),
      })),
      categories: categories.map(mapReference),
      tags: tags.map(mapReference),
      performanceTags: performanceTags.map((row) => ({
        performanceId: String(row.performance_id),
        tagId: String(row.tag_id),
        createdAtMs: Number(row.created_at_ms),
      })),
      performanceFacets: performanceFacets.map((row) => ({
        performanceId: String(row.performance_id),
        kind: String(row.kind) as AndroidBackupDataV1['performanceFacets'][number]['kind'],
        value: String(row.value),
        sortOrder: Number(row.sort_order),
      })),
      songs: songs.map((row) => ({
        id: String(row.id),
        performanceId: String(row.performance_id),
        artistName: String(row.artist_name),
        titles: parseTitles(row.titles_json),
        createdAtMs: Number(row.created_at_ms),
        updatedAtMs: Number(row.updated_at_ms),
      })),
      mediaAssets: mediaAssets.map((row) => ({
        id: String(row.id),
        performanceId: String(row.performance_id),
        kind: String(row.kind) as AndroidBackupDataV1['mediaAssets'][number]['kind'],
        archivePath: `media/${String(row.id)}.jpg`,
        mimeType: 'image/jpeg',
        byteSize: Number(row.byte_size),
        sha256: String(row.sha256).toLowerCase(),
        width: nullableNumber(row.width),
        height: nullableNumber(row.height),
        createdAtMs: Number(row.created_at_ms),
      })),
      settings: settings.flatMap(mapSetting),
    })
  }
}

function mapReference(row: Row) {
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    createdAtMs: Number(row.created_at_ms),
    updatedAtMs: Number(row.updated_at_ms),
  }
}

function mapSetting(row: Row): AndroidBackupSettingV1[] {
  const key = String(row.key) as AndroidBackupSettingV1['key']
  try {
    return [{
      key,
      value: normalizeBackupSettingValue(key, JSON.parse(String(row.value_json))),
      updatedAtMs: Number(row.updated_at_ms),
    }]
  } catch {
    return []
  }
}

function parseTitles(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value)) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function requiredMediaPath(paths: Map<string, string>, id: string): string {
  const value = paths.get(id)
  if (!value) throw new Error(`恢复媒体路径缺失：${id}`)
  return value
}
