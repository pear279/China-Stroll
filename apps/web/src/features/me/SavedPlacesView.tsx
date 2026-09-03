import { ArrowLeft, Bookmark } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { Coordinate, PlaceSummary } from "../../../../../packages/shared/src"
import { useLocale } from "../../lib/i18n"
import { PlaceCard } from "../attractions/PlaceCard"

type SavedPlacesViewProps = {
  busy: string | null
  places: PlaceSummary[]
  plannedIds: Set<string | null>
  savedPlaceIds: Set<string>
  selectedDay: number
  userCoordinate: Coordinate | null
  onAddPlace: (placeId: string, dayNumber?: number) => Promise<void>
  onOpenDetails: (placeId: string) => void
  onShowOnMap: (placeId: string) => void
  onToggleSaved: (placeId: string) => Promise<void>
}

export function SavedPlacesView({
  busy,
  places,
  plannedIds,
  savedPlaceIds,
  selectedDay,
  userCoordinate,
  onAddPlace,
  onOpenDetails,
  onShowOnMap,
  onToggleSaved,
}: SavedPlacesViewProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const savedPlaces = places.filter((place) => savedPlaceIds.has(place.id))

  return (
    <section className="module-view secondary-view" aria-labelledby="saved-heading">
      <header className="secondary-header">
        <button className="secondary-back" type="button" aria-label={t("common.back")} onClick={() => navigate("/me")}>
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <h1 id="saved-heading">{t("mine.savedTitle")}</h1>
      </header>

      {savedPlaces.length === 0 ? (
        <div className="collection-empty" role="status">
          <Bookmark aria-hidden="true" size={26} />
          <h2>{t("mine.savedEmpty")}</h2>
          <button className="primary-button" type="button" onClick={() => navigate("/attractions")}>
            {t("mine.exploreAttractions")}
          </button>
        </div>
      ) : (
        <div className="place-grid place-grid--list">
          {savedPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              planned={plannedIds.has(place.id)}
              saved
              selectedDay={selectedDay}
              busy={busy}
              userCoordinate={userCoordinate}
              mode="list"
              onDetails={onOpenDetails}
              onSave={onToggleSaved}
              onAdd={onAddPlace}
              onShowOnMap={onShowOnMap}
            />
          ))}
        </div>
      )}
    </section>
  )
}
