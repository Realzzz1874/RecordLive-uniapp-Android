export interface ParsePlatformUrl {
  href: string
  protocol: 'http:' | 'https:'
  hostname: string
  pathname: string
  search: string
}

export function parseHttpUrl(value: string): ParsePlatformUrl | null {
  const normalized = value.trim()
  if (/\s/.test(normalized)) return null
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)?(\?[^#]*)?(?:#.*)?$/i.exec(normalized)
  if (!match) return null

  const [, scheme, authority, rawPath = '', search = ''] = match
  const hostMatch = /^([a-z\d.-]+)(?::(\d{1,5}))?$/i.exec(authority)
  if (!hostMatch) return null

  const port = hostMatch[2]
  if (port && Number(port) > 65_535) return null

  return {
    href: normalized,
    protocol: `${scheme.toLowerCase()}:` as 'http:' | 'https:',
    hostname: hostMatch[1].toLowerCase(),
    pathname: rawPath || '/',
    search,
  }
}

export function urlSearchParam(url: ParsePlatformUrl, name: string): string | null {
  const query = url.search.startsWith('?') ? url.search.slice(1) : url.search
  for (const component of query.split('&')) {
    if (!component) continue
    const separatorIndex = component.indexOf('=')
    const rawKey = separatorIndex >= 0 ? component.slice(0, separatorIndex) : component
    if (decodeQueryComponent(rawKey) !== name) continue
    const rawValue = separatorIndex >= 0 ? component.slice(separatorIndex + 1) : ''
    return decodeQueryComponent(rawValue)
  }
  return null
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}
