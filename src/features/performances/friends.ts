export const FRIENDS_STORAGE_KEY = 'recordlive.friends.v1'

export function normalizeFriends(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))]
}

export function friendOptions(value: unknown, selectedFriends: readonly string[] = []): string[] {
  const stored = normalizeFriends(value)
  const selected = normalizeFriends(selectedFriends)
  return [...selected.filter((friend) => !stored.includes(friend)), ...stored]
}
