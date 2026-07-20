import preparedMusicalNames from './musical.json'
import preparedOperaNames from './opera.json'

export const PREPARED_PLAY_NAMES: readonly string[] = uniquePlayNames([
  ...(preparedMusicalNames as string[]),
  ...(preparedOperaNames as string[]),
])

export function playNameSuggestions(
  customNames: readonly string[],
  search: string,
  limit = 50,
): string[] {
  const query = search.trim().toLocaleLowerCase()
  if (!query || limit <= 0) return []

  return uniquePlayNames([...customNames, ...PREPARED_PLAY_NAMES])
    .filter((name) => name.toLocaleLowerCase().includes(query))
    .slice(0, limit)
}

function uniquePlayNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}
