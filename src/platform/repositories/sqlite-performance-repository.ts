import { DomainNotFoundError, DomainValidationError } from '@/domain/errors'
import {
  PerformanceStatus,
  type Performance,
  type PerformanceFacetKind,
  type MediaAsset,
  type MediaAssetKind,
} from '@/domain/performance'
import type {
  PerformanceDraft,
  PerformancePage,
  PerformanceQuery,
  PerformanceRepository,
} from '@/features/performances/repository'
import type { DatabaseDriver, DatabaseRow } from '@/platform/database/driver'
import {
  sqlInteger,
  sqlNullableText,
  sqlNumber,
  sqlOptionalNumber,
  sqlText,
} from '@/platform/database/sql-values'

interface PerformanceRow extends DatabaseRow {
  id: string
  name: string
  started_at_ms: number
  city: string
  venue: string
  remark: string
  ticket_price_amount: string
  ticket_price_currency: string
  paid_price_amount: string
  paid_price_currency: string
  other_cost_amount: string
  other_cost_currency: string
  seat: string
  rating: number
  status: number
  category_id: string | null
  latitude: number | null
  longitude: number | null
  created_at_ms: number
  updated_at_ms: number
}

interface TagRow extends DatabaseRow {
  tag_id: string
}

interface FacetRow extends DatabaseRow {
  kind: string
  value: string
}

interface CountRow extends DatabaseRow {
  count: number
}

interface MediaRow extends DatabaseRow {
  id: string
  kind: string
  relative_path: string
  mime_type: string
  byte_size: number
  sha256: string
  width: number | null
  height: number | null
  created_at_ms: number
}

interface SQLitePerformanceRepositoryOptions {
  generateId?: () => string
  now?: () => number
}

const SELECT_COLUMNS = `
  id, name, started_at_ms, city, venue, remark,
  ticket_price_amount, ticket_price_currency,
  paid_price_amount, paid_price_currency,
  other_cost_amount, other_cost_currency,
  seat, rating, status, category_id, latitude, longitude,
  created_at_ms, updated_at_ms
`.trim()

export class SQLitePerformanceRepository implements PerformanceRepository {
  private readonly generateId: () => string
  private readonly now: () => number

  constructor(
    private readonly driver: DatabaseDriver,
    options: SQLitePerformanceRepositoryOptions = {},
  ) {
    this.generateId = options.generateId ?? createId
    this.now = options.now ?? Date.now
  }

  async get(id: string): Promise<Performance | null> {
    const rows = await this.driver.query<PerformanceRow>(
      `SELECT ${SELECT_COLUMNS} FROM performances WHERE id = ${sqlText(id)} AND deleted_at_ms IS NULL LIMIT 1`,
    )
    return rows[0] ? this.hydrate(rows[0]) : null
  }

  async list(query: PerformanceQuery = {}): Promise<PerformancePage> {
    const where = buildWhere(query)
    const countRows = await this.driver.query<CountRow>(
      `SELECT COUNT(*) AS count FROM performances p WHERE ${where}`,
    )
    const total = Number(countRows[0]?.count ?? 0)
    const offset = normalizePageValue(query.offset, 0, 'offset')
    const limit = normalizePageValue(query.limit, 50, 'limit')
    const direction = query.sortDirection === 'ascending' ? 'ASC' : 'DESC'
    const rows = await this.driver.query<PerformanceRow>(
      `SELECT ${SELECT_COLUMNS} FROM performances p WHERE ${where} ORDER BY p.started_at_ms ${direction}, p.id ${direction} LIMIT ${sqlInteger(limit)} OFFSET ${sqlInteger(offset)}`,
    )
    const items = await Promise.all(rows.map((row) => this.hydrate(row)))
    return { items, total, hasMore: offset + items.length < total }
  }

  async save(draft: PerformanceDraft): Promise<Performance> {
    validateDraft(draft)
    const existing = draft.id ? await this.get(draft.id) : null
    if (draft.id && !existing) throw new DomainNotFoundError('演出记录不存在')

    const timestamp = this.now()
    const item: Performance = {
      ...cloneDraft(draft),
      id: existing?.id ?? draft.id ?? this.generateId(),
      name: draft.name.trim(),
      tagIds: uniqueStrings(draft.tagIds),
      facets: normalizeFacets(draft.facets),
      createdAtMs: existing?.createdAtMs ?? timestamp,
      updatedAtMs: timestamp,
    }

    await this.driver.transaction(async () => {
      const coordinate = item.coordinate
      const statements = [
        `
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
            ${sqlText(item.ticketPrice.amount)}, ${sqlText(item.ticketPrice.currency)},
            ${sqlText(item.paidPrice.amount)}, ${sqlText(item.paidPrice.currency)},
            ${sqlText(item.otherCost.amount)}, ${sqlText(item.otherCost.currency)},
            ${sqlText(item.seat)}, ${sqlNumber(item.rating)}, ${sqlInteger(item.status)},
            ${sqlNullableText(item.categoryId)},
            ${sqlOptionalNumber(coordinate?.latitude ?? null, 'latitude')},
            ${sqlOptionalNumber(coordinate?.longitude ?? null, 'longitude')},
            ${sqlInteger(item.createdAtMs)}, ${sqlInteger(item.updatedAtMs)}, NULL
          )
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            started_at_ms = excluded.started_at_ms,
            city = excluded.city,
            venue = excluded.venue,
            remark = excluded.remark,
            ticket_price_amount = excluded.ticket_price_amount,
            ticket_price_currency = excluded.ticket_price_currency,
            paid_price_amount = excluded.paid_price_amount,
            paid_price_currency = excluded.paid_price_currency,
            other_cost_amount = excluded.other_cost_amount,
            other_cost_currency = excluded.other_cost_currency,
            seat = excluded.seat,
            rating = excluded.rating,
            status = excluded.status,
            category_id = excluded.category_id,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            updated_at_ms = excluded.updated_at_ms,
            deleted_at_ms = NULL
        `.trim(),
        `DELETE FROM performance_tag_links WHERE performance_id = ${sqlText(item.id)}`,
        `DELETE FROM performance_facets WHERE performance_id = ${sqlText(item.id)}`,
        `DELETE FROM media_assets WHERE performance_id = ${sqlText(item.id)}`,
        ...item.tagIds.map((tagId) =>
          `INSERT INTO performance_tag_links(performance_id, tag_id, created_at_ms) VALUES (${sqlText(item.id)}, ${sqlText(tagId)}, ${sqlInteger(timestamp)})`,
        ),
        ...Object.entries(item.facets).flatMap(([kind, values]) =>
          (values ?? []).map((value, index) =>
            `INSERT INTO performance_facets(performance_id, kind, value, sort_order) VALUES (${sqlText(item.id)}, ${sqlText(kind)}, ${sqlText(value)}, ${sqlInteger(index)})`,
          ),
        ),
        ...item.mediaAssets.map((asset) => `
          INSERT INTO media_assets(
            id, performance_id, kind, relative_path, mime_type,
            byte_size, sha256, width, height, created_at_ms
          ) VALUES (
            ${sqlText(asset.id)}, ${sqlText(item.id)}, ${sqlText(asset.kind)},
            ${sqlText(asset.relativePath)}, ${sqlText(asset.mimeType)},
            ${sqlInteger(asset.byteSize)}, ${sqlText(asset.sha256)},
            ${sqlOptionalNumber(asset.width, 'media width')},
            ${sqlOptionalNumber(asset.height, 'media height')},
            ${sqlInteger(asset.createdAtMs)}
          )
        `.trim()),
      ]
      await this.driver.execute(statements)
    })

    return clonePerformance(item)
  }

  async remove(id: string): Promise<void> {
    if (!await this.get(id)) throw new DomainNotFoundError('演出记录不存在')
    const timestamp = this.now()
    await this.driver.execute(
      `UPDATE performances SET deleted_at_ms = ${sqlInteger(timestamp)}, updated_at_ms = ${sqlInteger(timestamp)} WHERE id = ${sqlText(id)}`,
    )
  }

  private async hydrate(row: PerformanceRow): Promise<Performance> {
    const id = String(row.id)
    const [tagRows, facetRows, mediaRows] = await Promise.all([
      this.driver.query<TagRow>(
        `SELECT tag_id FROM performance_tag_links WHERE performance_id = ${sqlText(id)} ORDER BY created_at_ms ASC, tag_id ASC`,
      ),
      this.driver.query<FacetRow>(
        `SELECT kind, value FROM performance_facets WHERE performance_id = ${sqlText(id)} ORDER BY kind ASC, sort_order ASC`,
      ),
      this.driver.query<MediaRow>(
        `SELECT id, kind, relative_path, mime_type, byte_size, sha256, width, height, created_at_ms FROM media_assets WHERE performance_id = ${sqlText(id)} ORDER BY kind ASC`,
      ),
    ])
    const facets: Performance['facets'] = {}
    for (const facet of facetRows) {
      const kind = String(facet.kind) as PerformanceFacetKind
      const values = facets[kind] ?? []
      facets[kind] = [...values, String(facet.value)]
    }

    const latitude = nullableNumber(row.latitude)
    const longitude = nullableNumber(row.longitude)
    return {
      id,
      name: String(row.name),
      startedAtMs: Number(row.started_at_ms),
      city: String(row.city),
      venue: String(row.venue),
      remark: String(row.remark),
      ticketPrice: { amount: String(row.ticket_price_amount), currency: String(row.ticket_price_currency) },
      paidPrice: { amount: String(row.paid_price_amount), currency: String(row.paid_price_currency) },
      otherCost: { amount: String(row.other_cost_amount), currency: String(row.other_cost_currency) },
      seat: String(row.seat),
      rating: Number(row.rating),
      status: Number(row.status) as PerformanceStatus,
      categoryId: row.category_id === null ? null : String(row.category_id),
      coordinate: latitude === null || longitude === null ? null : { latitude, longitude },
      tagIds: tagRows.map(({ tag_id }) => String(tag_id)),
      facets,
      mediaAssets: mediaRows.map(mapMediaRow),
      createdAtMs: Number(row.created_at_ms),
      updatedAtMs: Number(row.updated_at_ms),
    }
  }
}

function buildWhere(query: PerformanceQuery): string {
  const conditions = ['p.deleted_at_ms IS NULL']
  const search = query.search?.trim().toLocaleLowerCase()
  if (search) {
    const pattern = sqlText(`%${escapeLike(search)}%`)
    conditions.push(`(
      lower(p.name) LIKE ${pattern} ESCAPE '\\'
      OR lower(p.city) LIKE ${pattern} ESCAPE '\\'
      OR lower(p.venue) LIKE ${pattern} ESCAPE '\\'
      OR lower(p.remark) LIKE ${pattern} ESCAPE '\\'
      OR lower(p.seat) LIKE ${pattern} ESCAPE '\\'
      OR EXISTS (
        SELECT 1 FROM performance_facets f
        WHERE f.performance_id = p.id AND lower(f.value) LIKE ${pattern} ESCAPE '\\'
      )
    )`)
  }
  if (query.categoryId) conditions.push(`p.category_id = ${sqlText(query.categoryId)}`)
  if (query.categoryIds !== undefined) {
    const categoryIds = uniqueStrings(query.categoryIds)
    conditions.push(categoryIds.length
      ? `p.category_id IN (${categoryIds.map(sqlText).join(', ')})`
      : '0 = 1')
  }
  if (query.statuses?.length) conditions.push(`p.status IN (${query.statuses.map((status) => sqlInteger(status)).join(', ')})`)
  if (query.lifecycles !== undefined) {
    conditions.push(buildLifecycleCondition(query.lifecycles, query.referenceTimeMs ?? Date.now()))
  }
  if (query.startedFromMs !== undefined) conditions.push(`p.started_at_ms >= ${sqlInteger(query.startedFromMs)}`)
  if (query.startedToMs !== undefined) conditions.push(`p.started_at_ms <= ${sqlInteger(query.startedToMs)}`)
  for (const tagId of new Set(query.tagIds ?? [])) {
    conditions.push(`EXISTS (SELECT 1 FROM performance_tag_links tl WHERE tl.performance_id = p.id AND tl.tag_id = ${sqlText(tagId)})`)
  }
  if (query.tagIdsAny !== undefined) {
    const tagIds = uniqueStrings(query.tagIdsAny)
    conditions.push(tagIds.length
      ? `EXISTS (
          SELECT 1 FROM performance_tag_links tl
          WHERE tl.performance_id = p.id AND tl.tag_id IN (${tagIds.map(sqlText).join(', ')})
        )`
      : '0 = 1')
  }
  return conditions.join(' AND ')
}

function buildLifecycleCondition(
  lifecycles: PerformanceQuery['lifecycles'],
  referenceTimeMs: number,
): string {
  const selected = new Set(lifecycles ?? [])
  if (selected.size === 0) return '0 = 1'
  const time = sqlInteger(referenceTimeMs)
  const clauses: string[] = []
  if (selected.has('attended')) clauses.push(`(p.status = 0 AND p.started_at_ms < ${time})`)
  if (selected.has('upcoming')) clauses.push(`(p.status = 0 AND p.started_at_ms >= ${time})`)
  if (selected.has('cancelled')) clauses.push('p.status = 1')
  if (selected.has('pending-sale')) clauses.push('p.status = 2')
  if (selected.has('missed')) clauses.push('p.status = 3')
  return `(${clauses.join(' OR ')})`
}

function validateDraft(draft: PerformanceDraft): void {
  if (draft.id !== undefined && !draft.id.trim()) {
    throw new DomainValidationError('演出 ID 不能为空')
  }
  if (!draft.name.trim()) throw new DomainValidationError('演出名称不能为空')
  if (!Number.isSafeInteger(draft.startedAtMs) || draft.startedAtMs < 0) {
    throw new DomainValidationError('演出时间无效')
  }
  if (!Number.isFinite(draft.rating) || draft.rating < 0 || draft.rating > 5) {
    throw new DomainValidationError('评分必须在 0 到 5 之间')
  }
  if (!Object.values(PerformanceStatus).includes(draft.status)) {
    throw new DomainValidationError('演出状态无效')
  }
  for (const currency of [draft.ticketPrice.currency, draft.paidPrice.currency, draft.otherCost.currency]) {
    if (currency.length !== 3) throw new DomainValidationError('币种必须是三位代码')
  }
  const mediaKinds = new Set<MediaAssetKind>()
  for (const asset of draft.mediaAssets) {
    if (mediaKinds.has(asset.kind)) throw new DomainValidationError('同一种媒体只能保存一份')
    mediaKinds.add(asset.kind)
    if (!asset.id.trim() || !asset.relativePath.trim() || !asset.mimeType.trim()) {
      throw new DomainValidationError('媒体信息不完整')
    }
    if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize < 0) {
      throw new DomainValidationError('媒体文件大小无效')
    }
  }
}

function cloneDraft(draft: PerformanceDraft): PerformanceDraft {
  return {
    ...draft,
    ticketPrice: { ...draft.ticketPrice },
    paidPrice: { ...draft.paidPrice },
    otherCost: { ...draft.otherCost },
    coordinate: draft.coordinate ? { ...draft.coordinate } : null,
    tagIds: [...draft.tagIds],
    facets: normalizeFacets(draft.facets),
    mediaAssets: draft.mediaAssets.map((asset) => ({ ...asset })),
  }
}

function clonePerformance(item: Performance): Performance {
  return { ...cloneDraft(item), id: item.id, createdAtMs: item.createdAtMs, updatedAtMs: item.updatedAtMs }
}

function normalizeFacets(facets: Performance['facets']): Performance['facets'] {
  return Object.fromEntries(
    Object.entries(facets)
      .map(([kind, values]) => [kind, uniqueStrings(values ?? [])])
      .filter(([, values]) => (values as string[]).length > 0),
  ) as Performance['facets']
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function normalizePageValue(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new DomainValidationError(`${label} 必须是非负整数`)
  }
  return resolved
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function mapMediaRow(row: MediaRow): MediaAsset {
  return {
    id: String(row.id),
    kind: String(row.kind) as MediaAssetKind,
    relativePath: String(row.relative_path),
    mimeType: String(row.mime_type),
    byteSize: Number(row.byte_size),
    sha256: String(row.sha256),
    width: nullableNumber(row.width),
    height: nullableNumber(row.height),
    createdAtMs: Number(row.created_at_ms),
  }
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
