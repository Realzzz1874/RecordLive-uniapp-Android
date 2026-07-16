export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainValidationError'
  }
}

export class DomainConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainConflictError'
  }
}

export class DomainNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainNotFoundError'
  }
}
