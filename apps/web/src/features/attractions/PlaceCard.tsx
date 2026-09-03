import { Bookmark, Check, Clock3, MapPinned, Milestone, Plus } from "lucide-react"
import {
  formatCategoryLabel,
  formatDurationHours,
  resolvePlaceImage,
  type Coordinate,
  type PlaceSummary,
} from "../../../../../packages/shared/src"
import { haversineKilometres } from "../../lib/navigation"
import { useLocale } from "../../lib/i18n"

type PlaceCardProps = {
  place: PlaceSummary
  planned: boolean
  saved: boolean
  selectedDay: number
  busy: string | null
  userCoordinate: Coordinate | null
  mode: "grid" | "list"
  note?: string | null
  onDetails: (placeId: string) => void
  onSave: (placeId: string) => Promise<void>
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
  onShowOnMap: (placeId: string) => void
}

export function PlaceCard({
  place,
  planned,
  saved,
  selectedDay,
  busy,
  userCoordinate,
  mode,
  note,
  onDetails,
  onSave,
  onAdd,
  onShowOnMap,
}: PlaceCardProps) {
  const { t } = useLocale()
  const distanceKm = userCoordinate ? haversineKilometres(userCoordinate, place.coordinate) : null

  return (
    <article className={mode === "list" ? "place-card place-card--list" : "place-card"}>
      <div className="place-card-media">
        <button
          className="place-card-hero"
          type="button"
          aria-label={t("attr.detailsFor", { name: place.name })}
          onClick={() => onDetails(place.id)}
        >
          <img src={resolvePlaceImage(place.id)} alt="" />
        </button>
        <h3 className="place-card-name">{place.name}</h3>
      </div>
      <div className="place-card-body">
        <div className="place-card-meta">
          <span className="place-card-category">{formatCategoryLabel(place.categoryCode)}</span>
          {note && <span className="place-card-note">{note}</span>}
          <div className="place-card-facts">
            <span><Clock3 aria-hidden="true" size={13} />{formatDurationHours(place.durationMinutes)}</span>
            {distanceKm !== null && <span><Milestone aria-hidden="true" size={13} />{distanceKm.toFixed(1)} km</span>}
          </div>
        </div>
        <div className="place-card-actions">
          <button
            type="button"
            aria-label={saved ? t("attr.removeSaved", { name: place.name }) : t("attr.savePlace", { name: place.name })}
            disabled={busy === `save-${place.id}`}
            onClick={() => void onSave(place.id)}
          >
            {saved ? <Check aria-hidden="true" size={15} /> : <Bookmark aria-hidden="true" size={15} />}
            <span>{saved ? t("attr.saved") : t("attr.save")}</span>
          </button>
          <button type="button" aria-label={t("attr.showOnMap", { name: place.name })} onClick={() => onShowOnMap(place.id)}>
            <MapPinned aria-hidden="true" size={15} />
            <span>{t("attr.map")}</span>
          </button>
          <button
            type="button"
            disabled={planned || busy === `add-${place.id}`}
            aria-label={planned ? t("attr.isPlanned", { name: place.name }) : t("attr.addToDayName", { name: place.name, day: selectedDay })}
            onClick={() => void onAdd(place.id, selectedDay)}
          >
            {planned ? <Check aria-hidden="true" size={15} /> : <Plus aria-hidden="true" size={15} />}
            <span>{planned ? t("attr.planned") : t("common.dayN", { n: selectedDay })}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
