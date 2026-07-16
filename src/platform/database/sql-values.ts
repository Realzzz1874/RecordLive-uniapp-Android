import { DomainValidationError } from '@/domain/errors'

export function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function sqlNullableText(value: string | null): string {
  return value === null ? 'NULL' : sqlText(value)
}

export function sqlInteger(value: number, label = 'integer'): string {
  if (!Number.isSafeInteger(value)) throw new DomainValidationError(`${label} 必须是安全整数`)
  return String(value)
}

export function sqlNumber(value: number, label = 'number'): string {
  if (!Number.isFinite(value)) throw new DomainValidationError(`${label} 必须是有限数值`)
  return String(value)
}

export function sqlOptionalNumber(value: number | null, label = 'number'): string {
  return value === null ? 'NULL' : sqlNumber(value, label)
}
