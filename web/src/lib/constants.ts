// Application constants

export const PAGE_SIZE = 50

export const SORTABLE_COLUMNS = [
  'change_1w',
  'change_1m',
  'change_3m',
  'change_6m',
  'change_1y',
  'change_3y',
  'change_5y',
  'daily_volume',
] as const

export type SortableColumn = typeof SORTABLE_COLUMNS[number]

export const PERFORMANCE_PERIODS = [
  { key: 'change_1w', label: '1W %' },
  { key: 'change_1m', label: '1M %' },
  { key: 'change_3m', label: '3M %' },
  { key: 'change_6m', label: '6M %' },
  { key: 'change_1y', label: '1Y %' },
  { key: 'change_3y', label: '3Y %' },
  { key: 'change_5y', label: '5Y %' },
] as const

