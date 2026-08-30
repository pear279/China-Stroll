import { durationFilters, formatCategoryLabel } from "../../../../../packages/shared/src"
import type { NearbyRadius } from "../../app-shell/types"

type PlaceFiltersProps = {
  categories: string[]
  category: string
  maxDuration: number | undefined
  radius: NearbyRadius
  hasLocation: boolean
  onCategory: (category: string) => void
  onDuration: (duration: number | undefined) => void
  onRadius: (radius: NearbyRadius) => void
}

export function PlaceFilters({
  categories,
  category,
  maxDuration,
  radius,
  hasLocation,
  onCategory,
  onDuration,
  onRadius,
}: PlaceFiltersProps) {
  return (
    <div className="place-filters">
      <label htmlFor="place-category">Category</label>
      <select id="place-category" value={category} onChange={(event) => onCategory(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map((code) => (
          <option key={code} value={code}>{formatCategoryLabel(code)}</option>
        ))}
      </select>

      <label htmlFor="place-duration">Visit length</label>
      <select
        id="place-duration"
        value={maxDuration ?? "any"}
        onChange={(event) => onDuration(event.target.value === "any" ? undefined : Number(event.target.value))}
      >
        {durationFilters.map((filter) => (
          <option key={filter.label} value={filter.maxDurationMinutes ?? "any"}>{filter.label}</option>
        ))}
      </select>

      <div className="radius-controls" aria-label="Nearby radius">
        {([1, 3, 5] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={radius === value ? "is-active" : undefined}
            disabled={!hasLocation}
            onClick={() => onRadius(value)}
          >
            {value} km
          </button>
        ))}
      </div>
    </div>
  )
}
