import { Clock3, ListFilter, Ruler, Search, X } from "lucide-react"
import { useState } from "react"
import { durationFilters, formatCategoryLabel } from "../../../../../packages/shared/src"
import type { NearbyRadius } from "../../app-shell/types"
import { BottomSheet } from "../../components/BottomSheet"
import { useLocale } from "../../lib/i18n"

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
  const { t } = useLocale()

  return (
    <div className="attraction-filters">
      <div className="attraction-search">
        <Search aria-hidden="true" size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t("attr.search")}
          aria-label={t("attr.search")}
        />
        {query && <button type="button" aria-label={t("attr.clearSearch")} onClick={() => onQuery("")}><X size={15} /></button>}
      </div>

      <div className="attraction-filter-icons" role="group" aria-label={t("common.filter")}>
        <button type="button" className={category !== "all" ? "is-active" : undefined} aria-label={t("attr.filterCategory")} onClick={() => setOpenFilter("category")}>
          <ListFilter size={17} />
          <span>{t("attr.category")}{category !== "all" ? ` · ${formatCategoryLabel(category)}` : ""}</span>
        </button>
        <button type="button" className={maxDuration !== undefined ? "is-active" : undefined} aria-label={t("attr.filterDuration")} onClick={() => setOpenFilter("duration")}>
          <Clock3 size={17} />
          <span>{t("attr.duration")}</span>
        </button>
        <button type="button" className={userCoordinateActive(radius) ? "is-active" : undefined} aria-label={t("attr.filterDistance")} onClick={() => setOpenFilter("radius")}>
          <Ruler size={17} />
          <span>{radius}km</span>
        </button>
      </div>

      <BottomSheet open={openFilter === "category"} title={t("attr.filterCategory")} onClose={() => setOpenFilter(null)}>
        <button type="button" className={category === "all" ? "bottom-sheet-option is-active" : "bottom-sheet-option"} onClick={() => { onCategory("all"); setOpenFilter(null) }}>{t("attr.all")}</button>
        {categories.map((code) => (
          <button key={code} type="button" className={category === code ? "bottom-sheet-option is-active" : "bottom-sheet-option"} onClick={() => { onCategory(code); setOpenFilter(null) }}>{formatCategoryLabel(code)}</button>
        ))}
      </BottomSheet>

      <BottomSheet open={openFilter === "duration"} title={t("attr.durationSheet")} onClose={() => setOpenFilter(null)}>
        {durationFilters.map((filter) => (
          <button key={filter.label} type="button" className={maxDuration === filter.maxDurationMinutes ? "bottom-sheet-option is-active" : "bottom-sheet-option"} onClick={() => { onDuration(filter.maxDurationMinutes); setOpenFilter(null) }}>{filter.label}</button>
        ))}
      </BottomSheet>

      <BottomSheet open={openFilter === "radius"} title={t("attr.distanceSheet")} onClose={() => setOpenFilter(null)}>
        {([1, 3, 5, 10, 20] as const).map((value) => (
          <button key={value} type="button" className={radius === value ? "bottom-sheet-option is-active" : "bottom-sheet-option"} disabled={!hasLocation} onClick={() => { onRadius(value); setOpenFilter(null) }}>{value} km</button>
        ))}
        {!hasLocation && <p className="location-unavailable" id={locationMessageId}>{t("attr.needLocation")}</p>}
      </BottomSheet>
    </div>
  )
}

function userCoordinateActive(radius: NearbyRadius) {
  // distance is only meaningful once a coordinate exists; visual active state is
  // kept minimal here and the sheet communicates the "需要定位" constraint.
  return radius !== 3
}
