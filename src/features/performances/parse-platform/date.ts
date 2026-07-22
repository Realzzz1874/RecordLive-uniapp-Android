export function parseFirstPerformanceDate(value: string): number | null {
  const match = value.trim().match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:\s+[^\d\s]+)?(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!match) return null
  const [, yearText, monthText, dayText, hourText = '0', minuteText = '0'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const date = new Date(year, month - 1, day, hour, minute)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) return null
  return date.getTime()
}
