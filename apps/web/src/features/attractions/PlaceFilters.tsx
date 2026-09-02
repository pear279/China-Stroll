import { Clock3, ListFilter, Ruler, Search, X } from "lucide-react"
import { useState } from "react"
import { durationFilters, formatCategoryLabel } from "../../../../../packages/shared/src"
import type { NearbyRadius } from "../../app-shell/types"
import { BottomSheet } from "../../components/BottomSheet"

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
        <button type="button" className={category !== "all" ? "is-active" : undefined} aria-label="分类筛选" onClick={() => setOpenFilter("category")}>
          <ListFilter size={17} />
          <span>分类{category !== "all" ? ` · ${formatCategoryLabel(category)}` : ""}</span>
        </button>
        <button type="button" className={maxDuration !== undefined ? "is-active" : undefined} aria-label="游览时间筛选" onClick={() => setOpenFilter("duration")}>
          <Clock3 size={17} />
          <span>时长</span>
        </button>
        <button type="button" className={userCoordinateActive(radius) ? "is-active" : undefined} aria-label="距离范围筛选" onClick={() => setOpenFilter("radius")}>
          <Ruler size={17} />
          <span>{radius}km</span>
        </button>
      </div>

      <BottomSheet open={openFilter === "category"} title="分类筛选" onClose={() => setOpenFilter(null)}>
        <button type="button" className={category === "all" ? "bottom-sheet-option is-active" : "bottom-sheet-option"} onClick={() => { onCategory("all"); setOpenFilter(null) }}>全部</button>
        {categories.map((code) => (
          <button key={code} type="button" className={category === code ? "bottom-sheet-option is-active" : "bottom-sheet-option"} onClick={() => { onCategory(code); setOpenFilter(null) }}>{formatCategoryLabel(code)}</button>
        ))}
      </BottomSheet>

      <BottomSheet open={openFilter === "duration"} title="游览时间" onClose={() => setOpenFilter(null)}>
        {durationFilters.map((filter) => (
          <button key={filter.label} type="button" className={maxDuration === filter.maxDurationMinutes ? "bottom-sheet-option is-active" : "bottom-sheet-option"} onClick={() => { onDuration(filter.maxDurationMinutes); setOpenFilter(null) }}>{filter.label}</button>
        ))}
      </BottomSheet>

      <BottomSheet open={openFilter === "radius"} title="距离范围" onClose={() => setOpenFilter(null)}>
        {([1, 3, 5, 10, 20] as const).map((value) => (
          <button key={value} type="button" className={radius === value ? "bottom-sheet-option is-active" : "bottom-sheet-option"} disabled={!hasLocation} onClick={() => { onRadius(value); setOpenFilter(null) }}>{value} km</button>
        ))}
        {!hasLocation && <p className="location-unavailable" id={locationMessageId}>需要先定位才能按距离筛选。</p>}
      </BottomSheet>
    </div>
  )
}

function userCoordinateActive(radius: NearbyRadius) {
  // distance is only meaningful once a coordinate exists; visual active state is
  // kept minimal here and the sheet communicates the "需要定位" constraint.
  return radius !== 3
}
