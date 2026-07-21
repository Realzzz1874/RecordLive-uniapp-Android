import { DomainValidationError } from '@/domain/errors'
import {
  PerformanceStatus,
  type MediaAsset,
  type Performance,
} from '@/domain/performance'
import type { PerformanceDraft, PerformanceRepository } from './repository'
import type {
  PerformanceImageRole,
  PerformanceMediaStorage,
  PreparedImage,
  SelectedImage,
} from '@/platform/media/types'

export const NEARBY_PERFORMANCE_WINDOW_MS = 2 * 60 * 60 * 1000

export const PERFORMANCE_COPY_FIELDS = [
  'poster',
  'name',
  'date',
  'city',
  'venue',
  'remark',
  'ticketPrice',
  'paidPrice',
  'artist',
  'play',
  'seat',
  'rating',
  'guest',
  'category',
  'tags',
  'channel',
  'friend',
  'company',
] as const

export type PerformanceCopyField = typeof PERFORMANCE_COPY_FIELDS[number]

export type PerformanceMediaChanges = Partial<Record<PerformanceImageRole, SelectedImage | null>>

export type SavePerformanceResult =
  | { kind: 'duplicate'; nearby: Performance[] }
  | { kind: 'saved'; performance: Performance; mediaCleanupFailed: boolean }

export class PerformanceEditorService {
  constructor(
    private readonly repository: PerformanceRepository,
    private readonly mediaStorage: PerformanceMediaStorage,
  ) {}

  async save(
    draft: PerformanceDraft,
    mediaChanges: PerformanceMediaChanges,
    skipNearbyCheck = false,
  ): Promise<SavePerformanceResult> {
    const normalizedDraft = normalizePerformanceDraft(draft)
    if (!skipNearbyCheck && !draft.id) {
      const nearby = await this.findNearby(normalizedDraft)
      if (nearby.length > 0) return { kind: 'duplicate', nearby }
    }

    const prepared: PreparedImage[] = []
    const obsoletePaths: string[] = []
    let mediaAssets = normalizedDraft.mediaAssets.map((asset) => ({ ...asset }))

    try {
      for (const role of ['poster', 'ticket'] as const) {
        if (!(role in mediaChanges)) continue
        const existing = mediaAssets.filter((asset) => belongsToRole(asset, role))
        obsoletePaths.push(...existing.map(({ relativePath }) => relativePath))
        mediaAssets = mediaAssets.filter((asset) => !belongsToRole(asset, role))

        const selected = mediaChanges[role]
        if (selected) {
          const image = await this.mediaStorage.prepare(role, selected)
          prepared.push(image)
          mediaAssets.push(...image.assets)
        }
      }

      const performance = await this.repository.save({ ...normalizedDraft, mediaAssets })
      let mediaCleanupFailed = false
      try {
        await this.mediaStorage.remove(uniquePaths(obsoletePaths))
      } catch {
        mediaCleanupFailed = true
      }
      return { kind: 'saved', performance, mediaCleanupFailed }
    } catch (error) {
      await Promise.allSettled(prepared.map(({ rollback }) => rollback()))
      throw error
    }
  }

  private async findNearby(draft: PerformanceDraft): Promise<Performance[]> {
    const page = await this.repository.list({
      startedFromMs: draft.startedAtMs - NEARBY_PERFORMANCE_WINDOW_MS,
      startedToMs: draft.startedAtMs + NEARBY_PERFORMANCE_WINDOW_MS,
      sortDirection: 'ascending',
      limit: 5,
    })
    return page.items.filter(({ id }) => id !== draft.id)
  }
}

export function createEmptyPerformanceDraft(now = Date.now()): PerformanceDraft {
  return {
    name: '',
    startedAtMs: now,
    city: '',
    venue: '',
    remark: '',
    ticketPrice: { amount: '0', currency: 'CNY' },
    paidPrice: { amount: '0', currency: 'CNY' },
    otherCost: { amount: '0', currency: 'CNY' },
    seat: '',
    rating: 0,
    status: PerformanceStatus.Normal,
    categoryId: null,
    coordinate: null,
    tagIds: [],
    facets: {},
    mediaAssets: [],
  }
}

export function copyPerformanceFields(
  destination: PerformanceDraft,
  source: Performance,
  selectedFields: readonly PerformanceCopyField[],
): PerformanceDraft {
  const selected = new Set(selectedFields)
  const next: PerformanceDraft = {
    ...destination,
    ticketPrice: { ...destination.ticketPrice },
    paidPrice: { ...destination.paidPrice },
    otherCost: { ...destination.otherCost },
    coordinate: destination.coordinate ? { ...destination.coordinate } : null,
    tagIds: [...destination.tagIds],
    facets: cloneFacets(destination.facets),
    mediaAssets: destination.mediaAssets.map((asset) => ({ ...asset })),
  }

  if (selected.has('name') && source.name.trim()) next.name = source.name
  if (selected.has('date')) next.startedAtMs = source.startedAtMs
  if (selected.has('city') && source.city.trim()) {
    next.city = source.city
    next.coordinate = null
  }
  if (selected.has('venue') && source.venue.trim()) {
    next.venue = source.venue
    next.coordinate = null
  }
  if (selected.has('remark') && source.remark.trim()) next.remark = source.remark
  if (selected.has('ticketPrice') && isPositiveAmount(source.ticketPrice.amount)) {
    next.ticketPrice = { ...source.ticketPrice }
  }
  if (selected.has('paidPrice') && isPositiveAmount(source.paidPrice.amount)) {
    next.paidPrice = { ...source.paidPrice }
  }
  if (selected.has('seat') && source.seat.trim()) next.seat = source.seat
  if (selected.has('rating') && source.rating > 0) next.rating = source.rating
  if (selected.has('category') && source.categoryId) next.categoryId = source.categoryId
  if (selected.has('tags') && source.tagIds.length) next.tagIds = [...source.tagIds]

  const facetFields: ReadonlyArray<[PerformanceCopyField, keyof Performance['facets']]> = [
    ['artist', 'artist'],
    ['play', 'play'],
    ['guest', 'guest'],
    ['channel', 'channel'],
    ['friend', 'friend'],
    ['company', 'company'],
  ]
  for (const [field, kind] of facetFields) {
    const values = source.facets[kind]
    if (selected.has(field) && values?.length) next.facets[kind] = [...values]
  }

  return next
}

export function performancePosterAsSelectedImage(performance: Performance): SelectedImage | null {
  const asset = performance.mediaAssets.find(({ kind }) => kind === 'poster')
    ?? performance.mediaAssets.find(({ kind }) => kind === 'poster_thumb')
  if (!asset?.relativePath) return null
  return {
    sourcePath: asset.relativePath,
    previewPath: asset.relativePath,
    byteSize: asset.byteSize,
    mimeType: asset.mimeType,
  }
}

export function normalizePerformanceDraft(draft: PerformanceDraft): PerformanceDraft {
  const name = draft.name.trim()
  const city = draft.city.trim()
  const venue = draft.venue.trim()
  if (!name) throw new DomainValidationError('请输入演出名称')
  if (!city) throw new DomainValidationError('请选择城市')
  if (!venue) throw new DomainValidationError('请选择场地')

  return {
    ...draft,
    name,
    city,
    venue,
    remark: draft.remark.trim(),
    seat: draft.seat.trim(),
    ticketPrice: normalizeCurrencyAmount(draft.ticketPrice.amount, draft.ticketPrice.currency),
    paidPrice: normalizeCurrencyAmount(draft.paidPrice.amount, draft.paidPrice.currency),
    otherCost: normalizeCurrencyAmount(draft.otherCost.amount, draft.otherCost.currency),
    tagIds: uniqueValues(draft.tagIds),
    facets: Object.fromEntries(
      Object.entries(draft.facets)
        .map(([kind, values]) => [kind, uniqueValues(values ?? [])])
        .filter(([, values]) => (values as string[]).length > 0),
    ),
    mediaAssets: draft.mediaAssets.map((asset) => ({ ...asset })),
  }
}

export function parseDelimitedValues(value: string): string[] {
  return uniqueValues(value.split(/[、,，;；\n]/))
}

export function appendSelectedName(names: readonly string[], name: string): string[] {
  return uniqueValues([...names, name])
}

export function replaceSelectedName(names: readonly string[], index: number, name: string): string[] {
  if (index < 0 || index >= names.length || !name.trim()) return [...names]
  const next = [...names]
  next[index] = name
  return uniqueValues(next)
}

export function moveSelectedName(names: readonly string[], from: number, to: number): string[] {
  if (from < 0 || from >= names.length || to < 0 || to >= names.length || from === to) return [...names]
  const next = [...names]
  const [moved] = next.splice(from, 1)
  if (moved !== undefined) next.splice(to, 0, moved)
  return next
}

function normalizeCurrencyAmount(amount: string, currency: string): Performance['ticketPrice'] {
  const normalizedCurrency = currency.trim().toLocaleUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new DomainValidationError('币种必须是三位代码')
  }
  const normalizedAmount = amount.trim() || '0'
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new DomainValidationError('花费金额最多保留两位小数')
  }
  return {
    amount: normalizedAmount.replace(/^0+(?=\d)/, ''),
    currency: normalizedCurrency,
  }
}

function belongsToRole(asset: MediaAsset, role: PerformanceImageRole): boolean {
  return role === 'poster'
    ? asset.kind === 'poster' || asset.kind === 'poster_thumb'
    : asset.kind === 'ticket_original' || asset.kind === 'ticket_thumb'
}

function cloneFacets(facets: Performance['facets']): Performance['facets'] {
  return Object.fromEntries(
    Object.entries(facets).map(([kind, values]) => [kind, values ? [...values] : values]),
  ) as Performance['facets']
}

function isPositiveAmount(value: string): boolean {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths.filter((path) => !path.startsWith('blob:')))]
}
