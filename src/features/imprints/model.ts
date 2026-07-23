import {
  derivePerformanceLifecycle,
  type Performance,
  type PerformanceLifecycle,
} from '@/domain/performance'
import type { PerformanceRepository } from '@/features/performances/repository'
import { ALL_PERFORMANCE_LIFECYCLES } from '@/features/preferences/model'

export interface ImprintFilter {
  categoryIds: string[]
  tagIds: string[]
  lifecycles: PerformanceLifecycle[]
}

export interface ImprintPreferences {
  filter: ImprintFilter
  alwaysShowDate: boolean
  showPerformanceTime: boolean
  showExpenseAmounts: boolean
}

export const DEFAULT_IMPRINT_PREFERENCES: ImprintPreferences = {
  filter: {
    categoryIds: [],
    tagIds: [],
    lifecycles: [...ALL_PERFORMANCE_LIFECYCLES],
  },
  alwaysShowDate: false,
  showPerformanceTime: true,
  showExpenseAmounts: true,
}

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

export type ImprintRankFacet = 'artist' | 'play'

export type ImprintExpenseMetric =
  | 'ticketPrice'
  | 'paidPrice'
  | 'otherCost'
  | 'ticketAndOther'
  | 'paidAndOther'

export interface ImprintTimesRankEntry {
  name: string
  times: number
}

export interface ImprintExpenseRankEntry extends ImprintTimesRankEntry {
  ticketPrice: string
  paidPrice: string
  otherCost: string
  ticketAndOther: string
  paidAndOther: string
}

export interface ImprintExpenseRankGroup {
  currency: string
  totals: Record<ImprintExpenseMetric, string>
  entries: ImprintExpenseRankEntry[]
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

export type ImprintPeriodSummary = Omit<ImprintYearSummary, 'year'>

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

export function filterImprintPerformances(
  performances: readonly Performance[],
  filter: ImprintFilter,
  referenceTimeMs = Date.now(),
): Performance[] {
  const categoryIds = new Set(filter.categoryIds)
  const tagIds = new Set(filter.tagIds)
  const lifecycles = new Set(filter.lifecycles)

  return performances.filter((performance) => {
    if (categoryIds.size && (!performance.categoryId || !categoryIds.has(performance.categoryId))) {
      return false
    }
    if (tagIds.size && !performance.tagIds.some((id) => tagIds.has(id))) return false
    return lifecycles.has(derivePerformanceLifecycle(performance, referenceTimeMs))
  })
}

export function normalizeImprintPreferences(value: unknown): ImprintPreferences {
  if (!isRecord(value)) return cloneImprintPreferences(DEFAULT_IMPRINT_PREFERENCES)
  const rawFilter = isRecord(value.filter) ? value.filter : {}
  const lifecycles = uniqueStrings(rawFilter.lifecycles).filter(isPerformanceLifecycle)

  return {
    filter: {
      categoryIds: uniqueStrings(rawFilter.categoryIds),
      tagIds: uniqueStrings(rawFilter.tagIds),
      lifecycles: Array.isArray(rawFilter.lifecycles)
        ? lifecycles
        : [...ALL_PERFORMANCE_LIFECYCLES],
    },
    alwaysShowDate: typeof value.alwaysShowDate === 'boolean'
      ? value.alwaysShowDate
      : DEFAULT_IMPRINT_PREFERENCES.alwaysShowDate,
    showPerformanceTime: typeof value.showPerformanceTime === 'boolean'
      ? value.showPerformanceTime
      : DEFAULT_IMPRINT_PREFERENCES.showPerformanceTime,
    showExpenseAmounts: typeof value.showExpenseAmounts === 'boolean'
      ? value.showExpenseAmounts
      : DEFAULT_IMPRINT_PREFERENCES.showExpenseAmounts,
  }
}

export function cloneImprintPreferences(value: ImprintPreferences): ImprintPreferences {
  return {
    filter: {
      categoryIds: [...value.filter.categoryIds],
      tagIds: [...value.filter.tagIds],
      lifecycles: [...value.filter.lifecycles],
    },
    alwaysShowDate: value.alwaysShowDate,
    showPerformanceTime: value.showPerformanceTime,
    showExpenseAmounts: value.showExpenseAmounts,
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
  return {
    year,
    ...summarizeImprintPerformances(yearPerformances, referenceTimeMs),
  }
}

export function summarizeImprintPerformances(
  performances: readonly Performance[],
  referenceTimeMs = Date.now(),
): ImprintPeriodSummary {
  const lifecycleCounts: Record<PerformanceLifecycle, number> = {
    attended: 0,
    upcoming: 0,
    cancelled: 0,
    'pending-sale': 0,
    missed: 0,
  }
  for (const performance of performances) {
    lifecycleCounts[derivePerformanceLifecycle(performance, referenceTimeMs)] += 1
  }

  const ratings = performances.map(({ rating }) => rating).filter((rating) => rating > 0)
  const cityRanking = rankValues(performances.map(({ city }) => [city]))
  const artistRanking = rankValues(performances.map(({ facets }) => facets.artist ?? []))
  const playRanking = rankValues(performances.map(({ facets }) => facets.play ?? []))

  return {
    total: performances.length,
    uniqueDays: new Set(performances.map(({ startedAtMs }) => localDateKey(startedAtMs))).size,
    lifecycleCounts,
    cityCount: cityRanking.length,
    artistCount: artistRanking.length,
    playCount: playRanking.length,
    averageRating: ratings.length
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : null,
    expenses: summarizeExpenses(performances),
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

export function summarizeImprintTimesRank(
  performances: readonly Performance[],
  facet: ImprintRankFacet,
): ImprintTimesRankEntry[] {
  const counts = new Map<string, number>()
  for (const performance of performances) {
    for (const name of normalizedFacetValues(performance, facet)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, times]) => ({ name, times }))
    .sort(compareTimesRankEntries)
}

export function summarizeImprintExpenseRank(
  performances: readonly Performance[],
  facet: ImprintRankFacet,
  metric: ImprintExpenseMetric,
): ImprintExpenseRankGroup[] {
  const times = new Map(
    summarizeImprintTimesRank(performances, facet).map((entry) => [entry.name, entry.times]),
  )
  const totalsByCurrency = new Map<string, ExpenseAccumulator>()
  const valuesByCurrency = new Map<string, Map<string, ExpenseAccumulator>>()

  for (const performance of performances) {
    const names = normalizedFacetValues(performance, facet)
    const amounts = performanceExpenseAmounts(performance)
    const currencies = new Set(amounts.map(({ currency }) => currency).filter(Boolean))

    for (const currency of currencies) {
      const totals = ensureExpenseAccumulator(totalsByCurrency, currency)
      addPerformanceAmounts(totals, amounts, currency)

      for (const name of names) {
        const byName = valuesByCurrency.get(currency) ?? new Map<string, ExpenseAccumulator>()
        valuesByCurrency.set(currency, byName)
        const values = ensureExpenseAccumulator(byName, name)
        addPerformanceAmounts(values, amounts, currency)
      }
    }
  }

  return [...valuesByCurrency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, byName]) => {
      const totals = expenseMetrics(totalsByCurrency.get(currency) ?? emptyExpenseAccumulator())
      const entries = [...byName.entries()]
        .map(([name, values]) => ({
          name,
          times: times.get(name) ?? 0,
          ...expenseMetrics(values),
        }))
        .sort((left, right) => (
          compareDecimalStrings(right[metric], left[metric])
          || right.times - left.times
          || left.name.localeCompare(right.name, 'zh-CN')
        ))
      return { currency, totals, entries }
    })
}

export function imprintExpenseMetricValue(
  entry: Pick<ImprintExpenseRankEntry, ImprintExpenseMetric>,
  metric: ImprintExpenseMetric,
): string {
  return entry[metric]
}

export function formatImprintPercentage(value: string, total: string): string {
  const numerator = Number(value)
  const denominator = Number(total)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return '0.00%'
  }
  return `${((numerator / denominator) * 100).toFixed(2)}%`
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
        totalCost: sumDecimalStrings([
          paidPrice === '0' ? ticketPrice : paidPrice,
          otherCost,
        ]),
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

interface PerformanceExpenseAmount {
  kind: 'ticketPrice' | 'paidPrice' | 'otherCost'
  amount: string
  currency: string
}

interface ExpenseAccumulator {
  ticketPrice: string[]
  paidPrice: string[]
  otherCost: string[]
}

function normalizedFacetValues(
  performance: Performance,
  facet: ImprintRankFacet,
): string[] {
  return (performance.facets[facet] ?? []).map((name) => name.trim()).filter(Boolean)
}

function compareTimesRankEntries(
  left: ImprintTimesRankEntry,
  right: ImprintTimesRankEntry,
): number {
  return right.times - left.times || left.name.localeCompare(right.name, 'zh-CN')
}

function performanceExpenseAmounts(performance: Performance): PerformanceExpenseAmount[] {
  return ([
    ['ticketPrice', performance.ticketPrice],
    ['paidPrice', performance.paidPrice],
    ['otherCost', performance.otherCost],
  ] as const).map(([kind, value]) => ({
    kind,
    amount: value.amount,
    currency: value.currency.trim().toUpperCase(),
  }))
}

function ensureExpenseAccumulator(
  values: Map<string, ExpenseAccumulator>,
  key: string,
): ExpenseAccumulator {
  const existing = values.get(key)
  if (existing) return existing
  const created = emptyExpenseAccumulator()
  values.set(key, created)
  return created
}

function emptyExpenseAccumulator(): ExpenseAccumulator {
  return { ticketPrice: [], paidPrice: [], otherCost: [] }
}

function addPerformanceAmounts(
  accumulator: ExpenseAccumulator,
  amounts: readonly PerformanceExpenseAmount[],
  currency: string,
): void {
  for (const amount of amounts) {
    if (amount.currency === currency) accumulator[amount.kind].push(amount.amount)
  }
}

function expenseMetrics(
  accumulator: ExpenseAccumulator,
): Record<ImprintExpenseMetric, string> {
  const ticketPrice = sumDecimalStrings(accumulator.ticketPrice)
  const paidPrice = sumDecimalStrings(accumulator.paidPrice)
  const otherCost = sumDecimalStrings(accumulator.otherCost)
  return {
    ticketPrice,
    paidPrice,
    otherCost,
    ticketAndOther: sumDecimalStrings([ticketPrice, otherCost]),
    paidAndOther: sumDecimalStrings([paidPrice, otherCost]),
  }
}

function compareDecimalStrings(left: string, right: string): number {
  const leftPart = parseDecimal(left)
  const rightPart = parseDecimal(right)
  if (!leftPart || !rightPart) return 0
  const scale = Math.max(leftPart.scale, rightPart.scale)
  const leftValue = leftPart.value * (10n ** BigInt(scale - leftPart.scale))
  const rightValue = rightPart.value * (10n ** BigInt(scale - rightPart.scale))
  if (leftValue === rightValue) return 0
  return leftValue > rightValue ? 1 : -1
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

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))]
}

function isPerformanceLifecycle(value: string): value is PerformanceLifecycle {
  return ALL_PERFORMANCE_LIFECYCLES.includes(value as PerformanceLifecycle)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
