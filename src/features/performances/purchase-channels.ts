export const PURCHASE_CHANNELS_STORAGE_KEY = 'recordlive.purchase-channels.v1'

export const DEFAULT_PURCHASE_CHANNELS = [
  '大麦',
  '秀动',
  '猫眼',
  '纷玩岛',
  '摩天轮',
  '票星球',
  '保利',
  '呼啦圈',
  '亚华湖',
  '中演票+',
  '金光票务',
  '澳门售票网',
  '闲鱼',
  '赠票',
  'CityLine',
  'URBTIX',
  'OPENTIX',
  'Art-Mate',
  'interpark',
  'Yes24',
  'NOL',
  'TicketLink',
  'TicketMaster',
  'ATG',
] as const

export function normalizePurchaseChannels(value: unknown): string[] {
  const source = Array.isArray(value) ? value : DEFAULT_PURCHASE_CHANNELS
  return [...new Set(source
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))]
}

export function purchaseChannelOptions(value: unknown, selectedChannel: string): string[] {
  const channels = normalizePurchaseChannels(value)
  const selected = selectedChannel.trim()
  return selected && !channels.includes(selected) ? [selected, ...channels] : channels
}
