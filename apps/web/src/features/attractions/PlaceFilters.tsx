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
  return (
    <div className="place-filters">
      <div className="place-search">
        <label htmlFor="place-search">Search reviewed places</label>
        <input
          id="place-search"
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>

      <label className="place-filter-field" htmlFor="place-category">
        Category
        <select id="place-category" value={category} onChange={(event) => onCategory(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((code) => (
            <option key={code} value={code}>{formatCategoryLabel(code)}</option>
          ))}
        </select>
      </label>

      <label className="place-filter-field" htmlFor="place-duration">
        Visit length
        <select
          id="place-duration"
          value={maxDuration ?? "any"}
          onChange={(event) => onDuration(event.target.value === "any" ? undefined : Number(event.target.value))}
        >
          {durationFilters.map((filter) => (
            <option key={filter.label} value={filter.maxDurationMinutes ?? "any"}>{filter.label}</option>
          ))}
        </select>
      </label>

      <div className="radius-controls" aria-label="Nearby radius">
        {([1, 3, 5] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={radius === value ? "is-active" : undefined}
            aria-pressed={radius === value}
            aria-describedby={!hasLocation ? locationMessageId : undefined}
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
