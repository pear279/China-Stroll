import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { Coordinate, PlaceSummary, TripSnapshot, TripStop } from "../../../../../packages/shared/src"
import { useLocale } from "../../lib/i18n"
import { PlaceCard } from "../attractions/PlaceCard"
import { parseDateKey } from "./itineraryCalendar"

// A place is "visited" when at least one of its itinerary stops is marked completed.
// When a place has several completed stops, the most recent trip-day date wins, and
// the place is shown once — unchecking a single stop never drops its history while
// another completed stop remains.
//
// TODO(visited): `trip_stops` has no persisted completion column yet, so completion
// lives in client state (`completedStopIds`) until the schema and Worker gain a
// stop-completion field. The sync rule itself is final.
export function deriveVisitedDates(
  stops: TripStop[],
  completedStopIds: Set<string>,
  dayDateByNumber: Map<number, string | null | undefined>,
): Map<string, string> {
  const result = new Map<string, string>()
  for (const stop of stops) {
    if (!stop.placeId || !completedStopIds.has(stop.id)) continue
    const date = dayDateByNumber.get(stop.dayNumber ?? 1)
    if (!date) continue
    const existing = result.get(stop.placeId)
    if (!existing || date > existing) result.set(stop.placeId, date)
  }
  return result
}

type VisitedPlacesViewProps = {
  busy: string | null
  places: PlaceSummary[]
  plannedIds: Set<string | null>
  savedPlaceIds: Set<string>
  selectedDay: number
  trip: TripSnapshot
  completedStopIds: Set<string>
  userCoordinate: Coordinate | null
  onAddPlace: (placeId: string, dayNumber?: number) => Promise<void>
  onOpenDetails: (placeId: string) => void
  onShowOnMap: (placeId: string) => void
  onToggleSaved: (placeId: string) => Promise<void>
}

export function VisitedPlacesView({
  busy,
  places,
  plannedIds,
  savedPlaceIds,
  selectedDay,
  trip,
  completedStopIds,
  userCoordinate,
  onAddPlace,
  onOpenDetails,
  onShowOnMap,
  onToggleSaved,
}: VisitedPlacesViewProps) {
  const { t, locale } = useLocale()
  const navigate = useNavigate()
  const dayDateByNumber = new Map(trip.days.map((day) => [day.dayNumber, day.date]))
  const visitedDates = deriveVisitedDates(trip.stops, completedStopIds, dayDateByNumber)
  const visitedPlaces = places.filter((place) => visitedDates.has(place.id))

  function visitedLabel(date: string): string {
    return t("mine.visitedOn", {
      date: parseDateKey(date).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" }),
    })
  }

  return (
    <section className="module-view secondary-view" aria-labelledby="visited-heading">
      <header className="secondary-header">
        <button className="secondary-back" type="button" aria-label={t("common.back")} onClick={() => navigate("/me")}>
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <h1 id="visited-heading">{t("mine.visitedTitle")}</h1>
      </header>

      {visitedPlaces.length === 0 ? (
        <div className="collection-empty" role="status">
          <CheckCircle2 aria-hidden="true" size={26} />
          <h2>{t("mine.visitedEmpty")}</h2>
          <p>{t("mine.visitedHint")}</p>
        </div>
      ) : (
        <div className="place-grid place-grid--list">
          {visitedPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              planned={plannedIds.has(place.id)}
              saved={savedPlaceIds.has(place.id)}
              selectedDay={selectedDay}
              busy={busy}
              userCoordinate={userCoordinate}
              mode="list"
              note={visitedLabel(visitedDates.get(place.id)!)}
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
