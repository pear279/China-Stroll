import { Bookmark, Check, CircleAlert, Clock3, MapPinned, Milestone, Plus } from "lucide-react"
import {
  formatCategoryLabel,
  formatDurationHours,
  resolvePlaceImage,
  type Coordinate,
  type PlaceSummary,
} from "../../../../../packages/shared/src"
import { haversineKilometres } from "../../lib/navigation"
import { useLocale, type TranslationKey } from "../../lib/i18n"

type PlaceCardProps = {
  place: PlaceSummary
  planned: boolean
  saved: boolean
  selectedDay: number
  busy: string | null
  userCoordinate: Coordinate | null
  mode: "grid" | "list"
  onDetails: (placeId: string) => void
  onSave: (placeId: string) => Promise<void>
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
  onShowOnMap: (placeId: string) => void
}

function reviewLabel(reviewDueAt: string | null | undefined, t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  if (!reviewDueAt) {
    return t("attr.reviewDatePending")
  }

  const date = reviewDueAt.slice(0, 10)
  return reviewDueAt < new Date().toISOString()
    ? t("attr.sourceRecheckDue", { date })
    : t("attr.reviewDue", { date })
}

export function PlaceCard({
  place,
  planned,
  saved,
  selectedDay,
  busy,
  userCoordinate,
  mode,
  onDetails,
  onSave,
  onAdd,
  onShowOnMap,
}: PlaceCardProps) {
  const { t } = useLocale()
  const distanceKm = userCoordinate ? haversineKilometres(userCoordinate, place.coordinate) : null

  return (
    <article className={mode === "list" ? "place-card place-card--list" : "place-card"}>
      <button
        className="place-image-button"
        type="button"
        aria-label={t("attr.detailsFor", { name: place.name })}
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
          {distanceKm !== null && <span><Milestone aria-hidden="true" size={15} />{t("common.kmAway", { n: distanceKm.toFixed(1) })}</span>}
          <span><CircleAlert aria-hidden="true" size={15} />{reviewLabel(place.reviewDueAt, t)}</span>
        </div>
        <div className="place-card-actions">
          <button
            type="button"
            aria-label={saved ? t("attr.removeSaved", { name: place.name }) : t("attr.savePlace", { name: place.name })}
            disabled={busy === `save-${place.id}`}
            onClick={() => void onSave(place.id)}
          >
            {saved ? <Check aria-hidden="true" size={16} /> : <Bookmark aria-hidden="true" size={16} />}
            {saved ? t("attr.saved") : t("attr.save")}
          </button>
          <button type="button" aria-label={t("attr.showOnMap", { name: place.name })} onClick={() => onShowOnMap(place.id)}>
            <MapPinned aria-hidden="true" size={16} />{t("attr.map")}
          </button>
          <button
            type="button"
            disabled={planned || busy === `add-${place.id}`}
            aria-label={planned ? t("attr.isPlanned", { name: place.name }) : t("attr.addToDayName", { name: place.name, day: selectedDay })}
            onClick={() => void onAdd(place.id, selectedDay)}
          >
            {planned ? <Check aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}
            {planned ? t("attr.planned") : t("common.dayN", { n: selectedDay })}
          </button>
        </div>
      </div>
    </article>
  )
}
