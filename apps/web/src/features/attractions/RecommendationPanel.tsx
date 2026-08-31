import { LoaderCircle, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import type {
  Coordinate,
  Locale,
  PlaceRecommendationInput,
  PlaceRecommendationResponse,
  PlaceSummary,
} from "../../../../../packages/shared/src"

type RecommendationPanelProps = {
  places: PlaceSummary[]
  locale: Locale
  coordinate: Coordinate | null
  radiusKm: 1 | 3 | 5 | null
  availableMinutes: number | null
  plannedPlaceIds: string[]
  selectedDay: number
  onRecommend: (input: PlaceRecommendationInput) => Promise<PlaceRecommendationResponse>
  onDetails: (placeId: string) => void
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
}

const preferenceOptions = [
  { id: "family", label: "Family" },
  { id: "history", label: "History" },
  { id: "relaxed", label: "Relaxed" },
  { id: "photography", label: "Photography" },
  { id: "half-day", label: "Half-day" },
] as const satisfies Array<{
  id: PlaceRecommendationInput["preferences"][number]
  label: string
}>

type RecommendationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; response: PlaceRecommendationResponse }
  | { status: "failed"; message: string }

function generatedByLabel(generatedBy: PlaceRecommendationResponse["generatedBy"]) {
  return generatedBy === "model" ? "AI-assisted recommendation" : "Reviewed-data match"
}

export function RecommendationPanel({
  places,
  locale,
  coordinate,
  radiusKm,
  availableMinutes,
  plannedPlaceIds,
  selectedDay,
  onRecommend,
  onDetails,
  onAdd,
}: RecommendationPanelProps) {
  const [selectedPreferences, setSelectedPreferences] = useState<PlaceRecommendationInput["preferences"]>([])
  const [context, setContext] = useState("")
  const [state, setState] = useState<RecommendationState>({ status: "idle" })
  const [busyPlaceId, setBusyPlaceId] = useState<string | null>(null)

  const placeById = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
  )
  const plannedSet = useMemo(() => new Set(plannedPlaceIds), [plannedPlaceIds])

  function togglePreference(preference: PlaceRecommendationInput["preferences"][number]) {
    setSelectedPreferences((current) =>
      current.includes(preference)
        ? current.filter((item) => item !== preference)
        : [...current, preference],
    )
  }

  async function handleSubmit() {
    setState({ status: "loading" })
    try {
      const response = await onRecommend({
        preferences: selectedPreferences,
        context,
        locale,
        coordinate,
        radiusKm,
        availableMinutes,
        candidatePlaceIds: places.map((place) => place.id),
        plannedPlaceIds,
      })
      setState({ status: "ready", response })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recommendations are unavailable right now."
      setState({ status: "failed", message })
    }
  }

  async function handleAdd(placeId: string) {
    setBusyPlaceId(placeId)
    try {
      await onAdd(placeId, selectedDay)
    } finally {
      setBusyPlaceId(null)
    }
  }

  return (
    <section className="recommendation-panel" aria-labelledby="recommendation-heading">
      <div className="recommendation-heading">
        <div>
          <span className="eyebrow">Trip fit</span>
          <h2 id="recommendation-heading">Recommendation picks</h2>
          <p>Mix reviewed filters with trip context to shortlist where to go next.</p>
        </div>
        <span className="count-chip">{places.length} candidates</span>
      </div>

      <div className="recommendation-controls">
        <div className="recommendation-chip-row" role="group" aria-label="Trip preferences">
          {preferenceOptions.map((option) => {
            const pressed = selectedPreferences.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                className={pressed ? "is-active" : undefined}
                aria-pressed={pressed}
                onClick={() => togglePreference(option.id)}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <label className="recommendation-context" htmlFor="recommendation-context">
          <span>Anything else?</span>
          <input
            id="recommendation-context"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Quiet morning, stroller-friendly, best views..."
          />
        </label>

        <button type="button" className="primary-button recommendation-submit" onClick={() => void handleSubmit()}>
          Recommend places
        </button>
      </div>

      {state.status === "idle" && (
        <div className="recommendation-state" role="status">
          <Sparkles aria-hidden="true" size={18} />
          <p>Select a few preferences to generate a reviewed shortlist.</p>
        </div>
      )}

      {state.status === "loading" && (
        <div className="recommendation-state" role="status">
          <LoaderCircle className="spin" aria-hidden="true" size={20} />
          <p>Finding matching reviewed places…</p>
        </div>
      )}

      {state.status === "failed" && (
        <div className="recommendation-state recommendation-state-error" role="status">
          <p>{state.message || "Recommendations are unavailable right now."}</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="recommendation-results" aria-live="polite">
          {state.response.results.length === 0 ? (
            <div className="recommendation-state" role="status">
              <p>No recommendations fit the current trip filters.</p>
            </div>
          ) : (
            state.response.results.map((result) => {
              const place = placeById.get(result.placeId)
              if (!place) {
                return null
              }

              const planned = plannedSet.has(place.id)

              return (
                <article key={place.id} className="recommendation-result">
                  <div className="recommendation-result-copy">
                    <span className="recommendation-badge">
                      {generatedByLabel(state.response.generatedBy)}
                    </span>
                    <h3>{place.name}</h3>
                    <p>{result.reason}</p>
                  </div>
                  <div className="recommendation-result-actions">
                    <button type="button" onClick={() => onDetails(place.id)}>
                      View {place.name}
                    </button>
                    <button
                      type="button"
                      disabled={planned || busyPlaceId === place.id}
                      aria-label={planned ? `${place.name} is planned` : `Add ${place.name} to day ${selectedDay}`}
                      onClick={() => void handleAdd(place.id)}
                    >
                      {planned ? "Planned" : `Add to day ${selectedDay}`}
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}

export type { RecommendationPanelProps }
