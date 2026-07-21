import preparedCompanyNameData from './company.json'

export const CUSTOM_COMPANIES_STORAGE_KEY = 'recordlive.custom-companies.v1'

export const PREPARED_COMPANY_NAMES: readonly string[] = normalizeCompanyNames(
  preparedCompanyNameData as string[],
)

export function normalizeCompanyNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))]
}

export function companyNameSuggestions(
  customNames: readonly string[],
  search: string,
  limit = 50,
): string[] {
  const query = search.trim().toLocaleLowerCase()
  if (!query || limit <= 0) return []

  return normalizeCompanyNames([...customNames, ...PREPARED_COMPANY_NAMES])
    .filter((name) => name.toLocaleLowerCase().includes(query))
    .slice(0, limit)
}

export function mergeCustomCompanyNames(
  storedNames: unknown,
  selectedNames: readonly string[],
): string[] {
  const customSelections = normalizeCompanyNames(selectedNames)
    .filter((name) => !PREPARED_COMPANY_NAMES.includes(name))
  return normalizeCompanyNames([...normalizeCompanyNames(storedNames), ...customSelections])
}
