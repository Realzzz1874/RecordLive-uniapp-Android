export function openExternalUrl(url: string): void {
  // #ifdef APP-PLUS
  plus.runtime.openURL(url)
  // #endif

  // #ifdef H5
  window.location.assign(url)
  // #endif
}
