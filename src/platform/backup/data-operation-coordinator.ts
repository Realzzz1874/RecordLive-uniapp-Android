export interface DataOperationCoordinator {
  withMutation<T>(operation: () => Promise<T>): Promise<T>
  withExclusiveDataAccess<T>(operation: () => Promise<T>): Promise<T>
}

export class DefaultDataOperationCoordinator implements DataOperationCoordinator {
  private tail: Promise<void> = Promise.resolve()
  private activeMutations = 0
  private pendingExclusives = 0
  private mutationDrainResolvers: Array<() => void> = []

  async withMutation<T>(operation: () => Promise<T>): Promise<T> {
    while (this.pendingExclusives > 0) await this.tail
    this.activeMutations += 1
    try {
      return await operation()
    } finally {
      this.activeMutations -= 1
      if (this.activeMutations === 0) {
        for (const resolve of this.mutationDrainResolvers.splice(0)) resolve()
      }
    }
  }

  async withExclusiveDataAccess<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail
    let release = () => {}
    this.pendingExclusives += 1
    this.tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    if (this.activeMutations > 0) {
      await new Promise<void>((resolve) => this.mutationDrainResolvers.push(resolve))
    }
    try {
      return await operation()
    } finally {
      this.pendingExclusives -= 1
      release()
    }
  }
}
