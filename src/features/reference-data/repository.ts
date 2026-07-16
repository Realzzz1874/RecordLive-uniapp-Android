import type {
  CategoryDraft,
  PerformanceCategory,
  PerformanceTag,
  TagDraft,
} from '@/domain/reference-data'

export interface ReferenceDataRepository {
  listCategories(): Promise<PerformanceCategory[]>
  saveCategory(draft: CategoryDraft): Promise<PerformanceCategory>
  removeCategory(id: string): Promise<void>
  listTags(): Promise<PerformanceTag[]>
  saveTag(draft: TagDraft): Promise<PerformanceTag>
  removeTag(id: string): Promise<void>
}
