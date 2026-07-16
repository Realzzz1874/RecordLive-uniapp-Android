export interface PerformanceCategory {
  id: string
  name: string
  sortOrder: number
  createdAtMs: number
  updatedAtMs: number
}

export interface PerformanceTag {
  id: string
  name: string
  sortOrder: number
  createdAtMs: number
  updatedAtMs: number
}

export interface CategoryDraft {
  id?: string
  name: string
  sortOrder?: number
}

export interface TagDraft {
  id?: string
  name: string
  sortOrder?: number
}
