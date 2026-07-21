import {
  derivePerformanceLifecycle,
  type Performance,
  type PerformanceLifecycle,
} from '@/domain/performance'
import type { PerformanceRepository } from '@/features/performances/repository'

export interface ImprintCalendarCell {
  dateMs: number
  day: number
  inCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  count: number
  hasPoster: boolean
  performances: Performance[]
}

export interface ImprintRankEntry {
  name: string
  count: number
}

export interface ImprintExpenseSummary {
  currency: string
  ticketPrice: string
  paidPrice: string
  otherCost: string
  totalCost: string
}

export interface ImprintYearSummary {
  year: number
  total: number
  uniqueDays: number
  lifecycleCounts: Record<PerformanceLifecycle, number>
  cityCount: number
  artistCount: number
  playCount: number
  averageRating: number | null
  expenses: ImprintExpenseSummary[]
  cityRanking: ImprintRankEntry[]
  artistRanking: ImprintRankEntry[]
  playRanking: ImprintRankEntry[]
}

export interface ImprintSnapshot {
  performances: Performance[]
  years: number[]
}

export class ImprintQueryService {
  constructor(private readonly repository: PerformanceRepository) {}

  async loadSnapshot(referenceTimeMs = Date.now()): Promise<ImprintSnapshot> {
    const performances = await listAllPerformances(this.repository)
    return {
      performances,
      years: imprintYears(performances, new Date(referenceTimeMs).getFullYear()),
    }
  }
}

export async function listAllPerformances(
  repository: PerformanceRepository,
): Promise<Performance[]> {
  const items: Performance[] = []
  const pageSize = 250
  let offset = 0

  while (true) {
    const page = await repository.list({
      sortDirection: 'ascending',
      offset,
      limit: pageSize,
    })
    items.push(...page.items)
    if (!page.hasMore || page.items.length === 0) return items
    offset += page.items.length
  }
}

export function buildMonthCalendar(
  year: number,
  monthIndex: number,
  performances: readonly Performance[],
  selectedDateMs: number,
  referenceTimeMs = Date.now(),
): ImprintCalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset)
  gridStart.setHours(0, 0, 0, 0)

  const performancesByDay = new Map<string, Performance[]>()
  for (const performance of performances) {
    const key = localDateKey(performance.startedAtMs)
    const values = performancesByDay.get(key) ?? []
    values.push(performance)
    performancesByDay.set(key, values)
  }

  const selectedKey = localDateKey(selectedDateMs)
  const todayKey = localDateKey(referenceTimeMs)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    )
    date.setHours(0, 0, 0, 0)
    const key = localDateKey(date.getTime())
    const dayPerformances = [...(performancesByDay.get(key) ?? [])]
      .sort((left, right) => left.startedAtMs - right.startedAtMs || left.id.localeCompare(right.id))

    return {
      dateMs: date.getTime(),
      day: date.getDate(),
      inCurrentMonth: date.getFullYear() === year && date.getMonth() === monthIndex,
      isToday: key === todayKey,
      isSelected: key === selectedKey,
      count: dayPerformances.length,
      hasPoster: dayPerformances.some(({ mediaAssets }) =>
        mediaAssets.some(({ kind }) => kind === 'poster' || kind === 'poster_thumb')),
      performances: dayPerformances,
    }
  })
}

export function summarizeImprintYear(
  year: number,
  performances: readonly Performance[],
  referenceTimeMs = Date.now(),
): ImprintYearSummary {
  const yearPerformances = performances.filter(
    ({ startedAtMs }) => new Date(startedAtMs).getFullYear() === year,
  )
  const lifecycleCounts: Record<PerformanceLifecycle, number> = {
    attended: 0,
    upcoming: 0,
    cancelled: 0,
    'pending-sale': 0,
    missed: 0,
  }
  for (const performance of yearPerformances) {
    lifecycleCounts[derivePerformanceLifecycle(performance, referenceTimeMs)] += 1
  }

  const ratings = yearPerformances.map(({ rating }) => rating).filter((rating) => rating > 0)
  const cityRanking = rankValues(yearPerformances.map(({ city }) => [city]))
  const artistRanking = rankValues(yearPerformances.map(({ facets }) => facets.artist ?? []))
  const playRanking = rankValues(yearPerformances.map(({ facets }) => facets.play ?? []))

  return {
    year,
    total: yearPerformances.length,
    uniqueDays: new Set(yearPerformances.map(({ startedAtMs }) => localDateKey(startedAtMs))).size,
    lifecycleCounts,
    cityCount: cityRanking.length,
    artistCount: artistRanking.length,
    playCount: playRanking.length,
    averageRating: ratings.length
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : null,
    expenses: summarizeExpenses(yearPerformances),
    cityRanking,
    artistRanking,
    playRanking,
  }
}

export function imprintYears(
  performances: readonly Performance[],
  currentYear = new Date().getFullYear(),
): number[] {
  return [...new Set([
    currentYear,
    ...performances.map(({ startedAtMs }) => new Date(startedAtMs).getFullYear()),
  ])].sort((left, right) => right - left)
}

export function localDateKey(timestamp: number): string {
  const date = new Date(timestamp)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function shiftImprintMonth(
  year: number,
  monthIndex: number,
  offset: number,
): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + offset, 1)
  return { year: date.getFullYear(), monthIndex: date.getMonth() }
}

export function seedImprintDateTime(
  dateMs: number,
  hour = 19,
  minute = 30,
): number {
  const date = new Date(dateMs)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

export function formatAggregatedAmount(value: string): string {
  const [integer, decimal = ''] = value.split('.')
  if (!decimal) return `${integer}.00`
  if (decimal.length === 1) return `${integer}.${decimal}0`
  return value
}

function rankValues(groups: readonly (readonly string[])[]): ImprintRankEntry[] {
  const counts = new Map<string, number>()
  for (const values of groups) {
    const uniqueValues = new Set(values.map((value) => value.trim()).filter(Boolean))
    for (const value of uniqueValues) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
}

export function summarizeExpenses(performances: readonly Performance[]): ImprintExpenseSummary[] {
  const currencies = new Map<string, {
    ticketPrice: string[]
    paidPrice: string[]
    otherCost: string[]
  }>()

  for (const performance of performances) {
    collectAmount(currencies, 'ticketPrice', performance.ticketPrice.amount, performance.ticketPrice.currency)
    collectAmount(currencies, 'paidPrice', performance.paidPrice.amount, performance.paidPrice.currency)
    collectAmount(currencies, 'otherCost', performance.otherCost.amount, performance.otherCost.currency)
  }

  return [...currencies.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, values]) => {
      const ticketPrice = sumDecimalStrings(values.ticketPrice)
      const paidPrice = sumDecimalStrings(values.paidPrice)
      const otherCost = sumDecimalStrings(values.otherCost)
      return {
        currency,
        ticketPrice,
        paidPrice,
        otherCost,
        totalCost: sumDecimalStrings([paidPrice, otherCost]),
      }
    })
    .filter(({ ticketPrice, paidPrice, otherCost }) =>
      ticketPrice !== '0' || paidPrice !== '0' || otherCost !== '0')
}

function collectAmount(
  currencies: Map<string, { ticketPrice: string[]; paidPrice: string[]; otherCost: string[] }>,
  kind: 'ticketPrice' | 'paidPrice' | 'otherCost',
  amount: string,
  currency: string,
): void {
  if (sumDecimalStrings([amount]) === '0') return
  const code = currency.trim().toUpperCase()
  if (!code) return
  const values = currencies.get(code) ?? { ticketPrice: [], paidPrice: [], otherCost: [] }
  values[kind].push(amount)
  currencies.set(code, values)
}

function sumDecimalStrings(values: readonly string[]): string {
  const parts = values.map(parseDecimal).filter((part): part is DecimalPart => part !== null)
  if (!parts.length) return '0'
  const scale = Math.max(...parts.map((part) => part.scale))
  const total = parts.reduce(
    (sum, part) => sum + part.value * (10n ** BigInt(scale - part.scale)),
    0n,
  )
  return formatDecimalPart(total, scale)
}

interface DecimalPart {
  value: bigint
  scale: number
}

function parseDecimal(rawValue: string): DecimalPart | null {
  const value = rawValue.trim()
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) return null
  const fraction = match[3] ?? ''
  const sign = match[1] === '-' ? -1n : 1n
  return {
    value: sign * BigInt(`${match[2]}${fraction}`),
    scale: fraction.length,
  }
}

function formatDecimalPart(value: bigint, scale: number): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  if (scale === 0) return `${negative ? '-' : ''}${absolute}`
  const digits = absolute.toString().padStart(scale + 1, '0')
  const integer = digits.slice(0, -scale)
  const fraction = digits.slice(-scale).replace(/0+$/, '')
  const result = fraction ? `${integer}.${fraction}` : integer
  return `${negative ? '-' : ''}${result}`
}
