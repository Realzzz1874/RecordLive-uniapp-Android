import { PerformanceStatus, type Performance } from '@/domain/performance'
import cityData from './cities.json'
import theatreData from './theatres.json'

interface RawCity {
  name: string
  nameEn: string
  city_origin: number
}

interface RawTheatre {
  city: string
  name: string
}

export type CityRegion = 'default' | 'other'

export interface LocationCity {
  name: string
  nameEn: string
  region: CityRegion
}

export interface CityGroup {
  initial: string
  cities: LocationCity[]
}

const cities = (cityData as RawCity[]).map<LocationCity>((city) => ({
  name: city.name.trim(),
  nameEn: city.nameEn.trim(),
  region: city.city_origin === 2 ? 'other' : 'default',
}))

const theatres = theatreData as RawTheatre[]

export function locationCities(
  region: CityRegion,
  search = '',
): LocationCity[] {
  const query = search.trim().toLocaleLowerCase()
  return cities.filter((city) => city.region === region && (
    !query
    || city.name.toLocaleLowerCase().includes(query)
    || city.nameEn.toLocaleLowerCase().includes(query)
  ))
}

export function groupedLocationCities(
  region: CityRegion,
  search = '',
): CityGroup[] {
  const grouped = new Map<string, LocationCity[]>()
  for (const city of locationCities(region, search)) {
    const initial = city.nameEn.slice(0, 1).toLocaleUpperCase() || '#'
    grouped.set(initial, [...(grouped.get(initial) ?? []), city])
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([initial, groupedCities]) => ({ initial, cities: groupedCities }))
}

export function frequentLocationCities(
  performances: readonly Performance[],
  limit = 5,
): string[] {
  const counts = new Map<string, number>()
  for (const performance of performances) {
    const city = performance.city.trim()
    if (!city || performance.status !== PerformanceStatus.Normal) continue
    counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount || leftName.localeCompare(rightName, 'zh-CN'))
    .slice(0, limit)
    .map(([name]) => name)
}

export function locationVenues(
  city: string,
  performances: readonly Performance[],
  search = '',
): string[] {
  const normalizedCity = city.trim()
  if (!normalizedCity) return []
  const query = search.trim().toLocaleLowerCase()
  const historical = performances
    .filter((performance) => performance.city.trim() === normalizedCity)
    .map(({ venue }) => venue.trim())
    .filter(Boolean)
  const catalog = theatres
    .filter((theatre) => theatre.city.trim() === normalizedCity)
    .map(({ name }) => name.trim())
  return [...new Set([...historical, ...catalog])]
    .filter((venue) => !query || venue.toLocaleLowerCase().includes(query))
}

export function formatSelectedLocation(city: string, venue: string): string {
  return [city.trim(), venue.trim()].filter(Boolean).join(' · ')
}
