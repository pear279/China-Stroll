import { LoaderCircle, Send, Sparkles } from "lucide-react"
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
  candidatePlaces: PlaceSummary[]
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
  { id: "family", label: "亲子" },
  { id: "history", label: "历史" },
  { id: "relaxed", label: "休闲" },
  { id: "photography", label: "摄影" },
  { id: "half-day", label: "半日" },
] as const satisfies Array<{ id: PlaceRecommendationInput["preferences"][number]; label: string }>

const labelToId = new Map<string, PlaceRecommendationInput["preferences"][number]>(
  preferenceOptions.map((option) => [option.label, option.id] as const),
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
  const [input, setInput] = useState("")
  const [state, setState] = useState<RecommendationState>({ status: "idle" })
  const [busyPlaceId, setBusyPlaceId] = useState<string | null>(null)

  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places])
  const plannedSet = useMemo(() => new Set(plannedPlaceIds), [plannedPlaceIds])

  const tokens = input.split(/\s+/).filter(Boolean)
  const selectedPreferences = [...new Set(tokens.filter((token) => labelToId.has(token)).map((token) => labelToId.get(token)!))]
  const context = tokens.filter((token) => !labelToId.has(token)).join(" ")

  function addTag(label: string) {
    const current = input.split(/\s+/).filter(Boolean)
    if (current.includes(label)) return
    if (current.filter((token) => labelToId.has(token)).length >= 5) return
    setInput((value) => value.trim() ? `${value.trim()} ${label}` : label)
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

  const recommendationNames = state.status === "ready"
    ? state.response.results
        .map((result) => placeById.get(result.placeId)?.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, 3)
    : []

  const preferenceLabel = selectedPreferences.map((preference) => preferenceOptions.find((option) => option.id === preference)?.label ?? preference).join("、")

  const canSend = tokens.length > 0

  return (
    <section className="recommendation-panel" aria-labelledby="recommendation-heading">
      <div className="recommendation-heading">
        <div>
          <span className="eyebrow">个性化推荐</span>
          <h2 id="recommendation-heading">景点个性化推荐</h2>
        </div>
      </div>

      <div className="recommendation-tags" role="group" aria-label="旅游偏好标签">
        {preferenceOptions.map((option) => {
          const active = tokens.includes(option.label)
          return (
            <button key={option.id} type="button" className={active ? "is-active" : undefined} aria-pressed={active} onClick={() => addTag(option.label)}>
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="recommendation-input-row">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="添加标签帮你推荐景点"
          aria-label="推荐偏好输入"
        />
        <button type="button" className={canSend ? "is-ready" : undefined} disabled={!canSend || state.status === "loading"} onClick={() => void handleSubmit()}>
          {state.status === "loading" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
          <span>发送</span>
        </button>
      </div>

      {state.status === "loading" && (
        <div className="recommendation-state" role="status">
          <LoaderCircle className="spin" aria-hidden="true" size={20} />
          <p>正在分析你的偏好并匹配景点…</p>
        </div>
      )}

      {state.status === "failed" && (
        <div className="recommendation-state recommendation-state-error" role="status">
          <p>{state.message || "推荐暂时不可用。"}</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="recommendation-results" aria-live="polite">
          <div className="recommendation-answer" role="status">
            <Sparkles aria-hidden="true" size={16} />
            <p>根据用户输入的“{tokens.join(" ")}”内容，分析得出用户偏好{preferenceLabel || "通用"}游玩偏好，推荐{recommendationNames.length ? recommendationNames.join("、") : "暂无"}景点。</p>
          </div>

          {state.response.results.length === 0 ? (
            <div className="recommendation-state" role="status">
              <p>没有景点符合当前偏好与筛选条件。</p>
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
                    <button type="button" onClick={() => onDetails(place.id)}>详情</button>
                    <button type="button" disabled={planned || busyPlaceId === place.id} onClick={() => void handleAdd(place.id)}>
                      {planned ? "已加入" : `加入第 ${selectedDay} 天`}
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
