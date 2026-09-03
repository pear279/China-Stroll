import { describe, expect, it } from "vitest"
import { addDays, addMonths, buildMonthDays, buildWeekDays, parseDateKey, startOfWeek, startOfMonth, toDateKey } from "./itineraryCalendar"

describe("itineraryCalendar", () => {
  it("round-trips date keys without a UTC shift", () => {
    const date = parseDateKey("2026-09-03")
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(3)
    expect(toDateKey(date)).toBe("2026-09-03")
  })

  it("builds a Sunday-first week around a Thursday anchor", () => {
    const anchor = parseDateKey("2026-09-03") // Thursday
    const week = buildWeekDays(anchor, parseDateKey("2026-09-03"))

    expect(week).toHaveLength(7)
    expect(week[0].key).toBe("2026-08-30") // Sunday
    expect(week[6].key).toBe("2026-09-05") // Saturday
    expect(week.map((day) => day.day)).toEqual([30, 31, 1, 2, 3, 4, 5])
  })

  it("marks today and keeps leading/trailing month days distinct", () => {
    const anchor = parseDateKey("2026-09-03")
    const month = buildMonthDays(anchor, parseDateKey("2026-09-03"))

    expect(month.some((day) => day.isToday)).toBe(true)
    expect(month.filter((day) => day.inCurrentMonth)).toHaveLength(30) // September has 30 days
    expect(month[0].key).toBe("2026-08-30") // first Sunday on/before Sep 1
    expect(month[0].inCurrentMonth).toBe(false)
  })

  it("trims fully empty trailing rows in the month grid", () => {
    // February 2026 starts on a Sunday, so a full month needs no trailing row.
    const month = buildMonthDays(parseDateKey("2026-02-10"), parseDateKey("2026-02-10"))
    expect(month.length % 7).toBe(0)
    expect(month[month.length - 1].inCurrentMonth).toBe(true)
  })

  it("shifts weeks and months without mutating the source", () => {
    const date = parseDateKey("2026-09-03")
    const nextWeek = addDays(date, 7)
    expect(toDateKey(nextWeek)).toBe("2026-09-10")

    const nextMonth = addMonths(date, 1)
    expect(toDateKey(nextMonth)).toBe("2026-10-03")

    expect(startOfWeek(date).getDay()).toBe(0)
    expect(startOfMonth(date).getDate()).toBe(1)
    expect(toDateKey(date)).toBe("2026-09-03") // source untouched
  })
})
