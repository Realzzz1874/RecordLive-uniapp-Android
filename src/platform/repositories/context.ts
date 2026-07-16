import type { AppRepositories } from './factory'
import { createAppRepositories } from './factory'

let repositoriesPromise: Promise<AppRepositories> | null = null

export function getAppRepositories(): Promise<AppRepositories> {
  repositoriesPromise ??= createAppRepositories()
  return repositoriesPromise
}
