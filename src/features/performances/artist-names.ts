import preparedArtistNameData from './names.json'

export const PREPARED_ARTIST_NAMES: readonly string[] = uniqueArtistNames(
  preparedArtistNameData as string[],
)

export function artistNameSuggestions(
  customNames: readonly string[],
  search: string,
  limit = 50,
): string[] {
  const query = search.trim().toLocaleLowerCase()
  if (!query || limit <= 0) return []

  return uniqueArtistNames([...customNames, ...PREPARED_ARTIST_NAMES])
    .filter((name) => name.toLocaleLowerCase().includes(query))
    .slice(0, limit)
}

function uniqueArtistNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}
