// Pure, local-time date helpers for the My itinerary calendar. Dates are kept as
// `YYYY-MM-DD` keys and manipulated with local `Date` values so weekday math never
// drifts across a UTC boundary.

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const

export type CalendarDay = {
  key: string
  day: number
  month: number // 0-based
  year: number
  inCurrentMonth: boolean
  isToday: boolean
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

export function startOfWeek(date: Date): Date {
  const next = new Date(date)
  next.setDate(next.getDate() - next.getDay())
  next.setHours(0, 0, 0, 0)
  return next
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

export function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function dayAt(date: Date, today: Date): CalendarDay {
  return {
    key: toDateKey(date),
    day: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear(),
    inCurrentMonth: true,
    isToday: isSameDay(date, today),
  }
}

// Week view: the seven days (Sunday-first) that contain `anchor`.
export function buildWeekDays(anchor: Date, today: Date): CalendarDay[] {
  const sunday = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, index) => dayAt(addDays(sunday, index), today))
}

// Month view: a trimmed, standard 7-column grid for the month containing `anchor`.
// Leading cells are the trailing days of the previous month; trailing cells are the
// leading days of the next month. Fully empty trailing rows are dropped.
export function buildMonthDays(anchor: Date, today: Date): CalendarDay[] {
  const first = startOfMonth(anchor)
  const leading = first.getDay()
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7
  const start = startOfWeek(first)

  return Array.from({ length: cellCount }, (_, index) => {
    const date = addDays(start, index)
    return {
      key: toDateKey(date),
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      inCurrentMonth: isSameMonth(date, first),
      isToday: isSameDay(date, today),
    }
  })
}
