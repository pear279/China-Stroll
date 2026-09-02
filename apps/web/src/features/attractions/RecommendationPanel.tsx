import { LoaderCircle, Send, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import type {
  Coordinate,
  Locale,
  PlaceRecommendationInput,
  PlaceRecommendationResponse,
  PlaceSummary,
} from "../../../../../packages/shared/src"
import { useLocale, type TranslationKey } from "../../lib/i18n"

type RecommendationPanelProps = {
  places: PlaceSummary[]
  candidatePlaces: PlaceSummary[]
  locale: Locale
  coordinate: Coordinate | null
  radiusKm: 1 | 3 | 5 | 10 | 20 | null
  availableMinutes: number | null
  plannedPlaceIds: string[]
  selectedDay: number
  onRecommend: (input: PlaceRecommendationInput) => Promise<PlaceRecommendationResponse>
  onDetails: (placeId: string) => void
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
}

const preferenceOptions = [
  { id: "history", token: "history", labelKey: "attr.tagHistory" },
  { id: "family", token: "family", labelKey: "attr.tagFamily" },
  { id: "photography", token: "photography", labelKey: "attr.tagPhotography" },
  { id: null, token: "food", labelKey: "attr.tagFood" },
  { id: null, token: "architecture", labelKey: "attr.tagArchitecture" },
  { id: null, token: "museum", labelKey: "attr.tagMuseum" },
  { id: null, token: "nature", labelKey: "attr.tagNature" },
  { id: null, token: "niche", labelKey: "attr.tagNiche" },
  { id: null, token: "night", labelKey: "attr.tagNight" },
] as const satisfies Array<{ id: PlaceRecommendationInput["preferences"][number] | null; token: string; labelKey: TranslationKey }>

const labelToId = new Map<string, PlaceRecommendationInput["preferences"][number]>(
  preferenceOptions.filter((option) => option.id !== null).map((option) => [option.token, option.id!] as const),
)

type RecommendationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; response: PlaceRecommendationResponse }
  | { status: "failed"; message: string }

export function RecommendationPanel({
  places,
  candidatePlaces,
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
  const { t } = useLocale()
  const [input, setInput] = useState("")
  const [state, setState] = useState<RecommendationState>({ status: "idle" })
  const [busyPlaceId, setBusyPlaceId] = useState<string | null>(null)

  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places])
  const plannedSet = useMemo(() => new Set(plannedPlaceIds), [plannedPlaceIds])

  const tokens = input.split(/\s+/).filter(Boolean)
  const selectedPreferences = [...new Set(tokens.filter((token) => labelToId.has(token)).map((token) => labelToId.get(token)!))]
  const context = tokens.filter((token) => !labelToId.has(token)).join(" ")

  function addTag(token: string) {
    const current = input.split(/\s+/).filter(Boolean)
    if (current.includes(token)) return
    if (current.filter((item) => preferenceOptions.some((option) => option.token === item)).length >= 5) return
    setInput((value) => value.trim() ? `${value.trim()} ${token}` : token)
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
        candidatePlaceIds: candidatePlaces.map((place) => place.id),
        plannedPlaceIds,
      })
      setState({ status: "ready", response })
    } catch (error) {
      const message = error instanceof Error ? error.message : t("attr.recommendFailed")
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

  const recommendationNames = state.status === "ready"
    ? state.response.results
        .map((result) => placeById.get(result.placeId)?.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, 3)
    : []

  const preferenceLabel = selectedPreferences.map((preference) => {
    const option = preferenceOptions.find((item) => item.id === preference)
    return option ? t(option.labelKey) : preference
  }).join("、")

  const canSend = tokens.length > 0

  return (
    <section className="recommendation-panel" aria-labelledby="recommendation-heading">
      <div className="recommendation-heading">
        <div>
          <span className="eyebrow">{t("attr.recEyebrow")}</span>
          <h2 id="recommendation-heading">{t("attr.personalRecommend")}</h2>
        </div>
      </div>

      <div className="recommendation-tags" role="group" aria-label={t("attr.recTagsLabel")}>
        {preferenceOptions.map((option) => {
          const active = tokens.includes(option.token)
          return (
            <button key={option.token} type="button" className={active ? "is-active" : undefined} aria-pressed={active} onClick={() => addTag(option.token)}>
              {t(option.labelKey)}
            </button>
          )
        })}
      </div>

      <div className="recommendation-input-row">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("attr.recommendPlaceholder")}
          aria-label={t("attr.recInputLabel")}
        />
        <button type="button" className={canSend ? "is-ready" : undefined} disabled={!canSend || state.status === "loading"} onClick={() => void handleSubmit()}>
          {state.status === "loading" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
          <span>{t("attr.send")}</span>
        </button>
      </div>

      {state.status === "loading" && (
        <div className="recommendation-state" role="status">
          <LoaderCircle className="spin" aria-hidden="true" size={20} />
          <p>{t("attr.analyzing")}</p>
        </div>
      )}

      {state.status === "failed" && (
        <div className="recommendation-state recommendation-state-error" role="status">
          <p>{state.message || t("attr.recommendFailed")}</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="recommendation-results" aria-live="polite">
          <div className="recommendation-answer" role="status">
            <Sparkles aria-hidden="true" size={16} />
            <p>{t("attr.recommendAnswer", { tags: tokens.join(" "), prefs: preferenceLabel || t("attr.recGeneric"), places: recommendationNames.length ? recommendationNames.join("、") : t("attr.recNone") })}</p>
          </div>

          {state.response.results.length === 0 ? (
            <div className="recommendation-state" role="status">
              <p>{t("attr.recNoMatch")}</p>
            </div>
          ) : (
            state.response.results.map((result) => {
              const place = placeById.get(result.placeId)
              if (!place) return null
              const planned = plannedSet.has(place.id)
              return (
                <article key={place.id} className="recommendation-result">
                  <div className="recommendation-result-copy">
                    <h3>{place.name}</h3>
                    <p>{result.reason}</p>
                  </div>
                  <div className="recommendation-result-actions">
                    <button type="button" onClick={() => onDetails(place.id)}>{t("common.details")}</button>
                    <button type="button" disabled={planned || busyPlaceId === place.id} onClick={() => void handleAdd(place.id)}>
                      {planned ? t("attr.planned") : t("attr.addToDay", { day: selectedDay })}
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
