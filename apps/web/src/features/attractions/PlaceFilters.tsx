import { Clock3, ListFilter, Ruler, Search, X } from "lucide-react"
import { useState } from "react"
import { durationFilters, formatCategoryLabel } from "../../../../../packages/shared/src"
import type { NearbyRadius } from "../../app-shell/types"

type PlaceFiltersProps = {
  categories: string[]
  category: string
  maxDuration: number | undefined
  query: string
  radius: NearbyRadius
  hasLocation: boolean
  locationMessageId: string
  onCategory: (category: string) => void
  onDuration: (duration: number | undefined) => void
  onQuery: (query: string) => void
  onRadius: (radius: NearbyRadius) => void
}

type OpenFilter = "category" | "duration" | "radius" | null

export function PlaceFilters({
  categories,
  category,
  maxDuration,
  query,
  radius,
  hasLocation,
  locationMessageId,
  onCategory,
  onDuration,
  onQuery,
  onRadius,
}: PlaceFiltersProps) {
  const [openFilter, setOpenFilter] = useState<OpenFilter>(null)

  function toggle(filter: OpenFilter) {
    setOpenFilter((current) => current === filter ? null : filter)
  }

  return (
    <div className="attraction-filters">
      <div className="attraction-search">
        <Search aria-hidden="true" size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索景点"
          aria-label="搜索景点"
        />
        {query && <button type="button" aria-label="清除搜索" onClick={() => onQuery("")}><X size={15} /></button>}
      </div>

      <div className="attraction-filter-icons" role="group" aria-label="筛选">
        <button type="button" className={category !== "all" || openFilter === "category" ? "is-active" : undefined} aria-label="分类筛选" onClick={() => toggle("category")}>
          <ListFilter size={17} />
        </button>
        <button type="button" className={maxDuration !== undefined || openFilter === "duration" ? "is-active" : undefined} aria-label="游览时间筛选" onClick={() => toggle("duration")}>
          <Clock3 size={17} />
        </button>
        <button type="button" className={openFilter === "radius" ? "is-active" : undefined} aria-label="距离范围筛选" onClick={() => toggle("radius")}>
          <Ruler size={17} />
        </button>
      </div>

      {openFilter === "category" && (
        <div className="attraction-filter-dropdown">
          <button type="button" className={category === "all" ? "is-active" : undefined} onClick={() => { onCategory("all"); setOpenFilter(null) }}>全部</button>
          {categories.map((code) => (
            <button key={code} type="button" className={category === code ? "is-active" : undefined} onClick={() => { onCategory(code); setOpenFilter(null) }}>{formatCategoryLabel(code)}</button>
          ))}
        </div>
      )}

      {openFilter === "duration" && (
        <div className="attraction-filter-dropdown">
          {durationFilters.map((filter) => (
            <button key={filter.label} type="button" className={maxDuration === filter.maxDurationMinutes ? "is-active" : undefined} onClick={() => { onDuration(filter.maxDurationMinutes); setOpenFilter(null) }}>{filter.label}</button>
          ))}
        </div>
      )}

      {openFilter === "radius" && (
        <div className="attraction-filter-dropdown" aria-describedby={!hasLocation ? locationMessageId : undefined}>
          {([1, 3, 5] as const).map((value) => (
            <button key={value} type="button" className={radius === value ? "is-active" : undefined} disabled={!hasLocation} onClick={() => { onRadius(value); setOpenFilter(null) }}>{value} km</button>
          ))}
        </div>
      )}
    </div>
  )
}
