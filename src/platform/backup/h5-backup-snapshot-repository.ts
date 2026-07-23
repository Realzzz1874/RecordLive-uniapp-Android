import { sortBackupData, type AndroidBackupDataV1 } from '@/domain/backup'
import type { CurrentRestoreState, RestorePlan } from '@/domain/backup-restore-plan'
import type { BackupSnapshotRepository } from '@/features/backup/repository'
import type { AppSettingsRepository } from '@/features/preferences/repository'
import type { PerformanceRepository } from '@/features/performances/repository'
import type { ReferenceDataRepository } from '@/features/reference-data/repository'

export class H5BackupSnapshotRepository implements BackupSnapshotRepository {
  private shadow: AndroidBackupDataV1 | null = null

  constructor(
    private readonly performances: PerformanceRepository,
    private readonly referenceData: ReferenceDataRepository,
    private readonly settings: AppSettingsRepository,
  ) {}

  async exportSnapshot(): Promise<AndroidBackupDataV1> {
    if (this.shadow) return clone(this.shadow)
    const [page, categories, tags] = await Promise.all([
      this.performances.list({ limit: 10_000 }),
      this.referenceData.listCategories(),
      this.referenceData.listTags(),
    ])
    const settings = []
    for (const key of [
      'performance-browse-preferences-v1',
      'want-see-preferences-v1',
      'imprint-preferences-v1',
      'quick-add-preferences-v1',
      'recordlive.theme-preference',
      'recordlive.purchase-channels.v1',
      'recordlive.friends.v1',
      'recordlive.custom-companies.v1',
    ] as const) {
      const value = await this.settings.get<unknown>(key)
      if (value !== null) settings.push({ key, value, updatedAtMs: Date.now() })
    }
    this.shadow = sortBackupData({
      performances: page.items.map((item) => ({
        id: item.id,
        name: item.name,
        startedAtMs: item.startedAtMs,
        city: item.city,
        venue: item.venue,
        remark: item.remark,
        ticketPriceAmount: item.ticketPrice.amount,
        ticketPriceCurrency: item.ticketPrice.currency,
        paidPriceAmount: item.paidPrice.amount,
        paidPriceCurrency: item.paidPrice.currency,
        otherCostAmount: item.otherCost.amount,
        otherCostCurrency: item.otherCost.currency,
        seat: item.seat,
        rating: item.rating,
        status: item.status,
        categoryId: item.categoryId,
        latitude: item.coordinate?.latitude ?? null,
        longitude: item.coordinate?.longitude ?? null,
        createdAtMs: item.createdAtMs,
        updatedAtMs: item.updatedAtMs,
      })),
      categories: categories.map((item) => ({ ...item })),
      tags: tags.map((item) => ({ ...item })),
      performanceTags: page.items.flatMap((item) =>
        item.tagIds.map((tagId) => ({
          performanceId: item.id,
          tagId,
          createdAtMs: item.updatedAtMs,
        }))),
      performanceFacets: page.items.flatMap((item) =>
        Object.entries(item.facets).flatMap(([kind, values]) =>
          (values ?? []).map((value, sortOrder) => ({
            performanceId: item.id,
            kind: kind as AndroidBackupDataV1['performanceFacets'][number]['kind'],
            value,
            sortOrder,
          })))),
      songs: [],
      mediaAssets: page.items.flatMap((item) =>
        item.mediaAssets.map((asset) => ({
          id: asset.id,
          performanceId: item.id,
          kind: asset.kind,
          archivePath: `media/${asset.id}.jpg`,
          mimeType: 'image/jpeg' as const,
          byteSize: asset.byteSize,
          sha256: asset.sha256,
          width: asset.width,
          height: asset.height,
          createdAtMs: asset.createdAtMs,
        }))),
      settings,
    })
    return clone(this.shadow)
  }

  async loadRestoreState(): Promise<CurrentRestoreState> {
    const data = await this.exportSnapshot()
    return {
      data,
      deletedCategoryIds: [],
      deletedTagIds: [],
      deletedPerformanceIds: [],
      mediaRelativePaths: Object.fromEntries(
        data.mediaAssets.map(({ id }) => [id, `h5-fake://${id}`]),
      ),
    }
  }

  async applyRestorePlan(plan: RestorePlan): Promise<void> {
    this.shadow = clone(plan.data)
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
