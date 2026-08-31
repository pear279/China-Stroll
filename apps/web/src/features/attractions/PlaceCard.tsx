import { Bookmark, Check, CircleAlert, Clock3, MapPinned, Milestone, Plus } from "lucide-react"
import {
  formatCategoryLabel,
  formatDurationHours,
  resolvePlaceImage,
  type Coordinate,
  type PlaceSummary,
} from "../../../../../packages/shared/src"
import { haversineKilometres } from "../../lib/navigation"

type PlaceCardProps = {
  place: PlaceSummary
  planned: boolean
  saved: boolean
  selectedDay: number
  busy: string | null
  userCoordinate: Coordinate | null
  onDetails: (placeId: string) => void
  onSave: (placeId: string) => Promise<void>
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
  onShowOnMap: (placeId: string) => void
}

function reviewLabel(reviewDueAt: string | null | undefined) {
  if (!reviewDueAt) {
    return "Review date pending"
  }

  const date = reviewDueAt.slice(0, 10)
  return reviewDueAt < new Date().toISOString()
    ? `Source recheck due ${date}`
    : `Review due ${date}`
}

export function PlaceCard({
  place,
  planned,
  saved,
  selectedDay,
  busy,
  userCoordinate,
  onDetails,
  onSave,
  onAdd,
  onShowOnMap,
}: PlaceCardProps) {
  const distanceKm = userCoordinate ? haversineKilometres(userCoordinate, place.coordinate) : null

  return (
    <article className="place-card">
      <button
        className="place-image-button"
        type="button"
        aria-label={`Details for ${place.name}`}
        onClick={() => onDetails(place.id)}
      >
        <img src={resolvePlaceImage(place.id)} alt={`${place.name} display artwork`} />
      </button>
      <div className="place-card-copy">
        <span className="place-category">{formatCategoryLabel(place.categoryCode)}</span>
        <h2>{place.name}</h2>
        <p>{place.shortIntro}</p>
        <div className="place-card-meta">
          <span><Clock3 aria-hidden="true" size={15} />{formatDurationHours(place.durationMinutes)}</span>
          {distanceKm !== null && <span><Milestone aria-hidden="true" size={15} />{distanceKm.toFixed(1)} km away</span>}
          <span><CircleAlert aria-hidden="true" size={15} />{reviewLabel(place.reviewDueAt)}</span>
        </div>
        <div className="place-card-actions">
          <button
            type="button"
            aria-label={saved ? `Remove ${place.name} from saved places` : `Save ${place.name}`}
            disabled={busy === `save-${place.id}`}
            onClick={() => void onSave(place.id)}
          >
            {saved ? <Check aria-hidden="true" size={16} /> : <Bookmark aria-hidden="true" size={16} />}
            {saved ? "Saved" : "Save"}
          </button>
          <button type="button" aria-label={`Show ${place.name} on map`} onClick={() => onShowOnMap(place.id)}>
            <MapPinned aria-hidden="true" size={16} />Map
          </button>
          <button
            type="button"
            disabled={planned || busy === `add-${place.id}`}
            aria-label={planned ? `${place.name} is planned` : `Add ${place.name} to day ${selectedDay}`}
            onClick={() => void onAdd(place.id, selectedDay)}
          >
            {planned ? <Check aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}
            {planned ? "Planned" : `Day ${selectedDay}`}
          </button>
        </div>
      </div>
    </article>
  )
}
