import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  PlaceRecommendationResponse,
  PlaceSummary,
} from "../../../../../packages/shared/src"
import { RecommendationPanel } from "./RecommendationPanel"

const palace: PlaceSummary = {
  id: "forbidden-city",
  locale: "en",
  name: "The Palace Museum",
  shortIntro: "Imperial courtyards at the heart of Beijing.",
  categoryCode: "historic",
  tags: ["history", "photography"],
  coordinate: [116.3907694, 39.9172757],
  durationMinutes: 240,
  coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
  aliases: ["Forbidden City"],
  highlights: ["Meridian Gate"],
  reviewedAt: "2026-08-30T00:00:00.000Z",
  reviewDueAt: "2026-09-29T00:00:00.000Z",
}

const museum: PlaceSummary = {
  id: "national-museum-of-china",
  locale: "en",
  name: "National Museum of China",
  shortIntro: "Major history galleries on Tiananmen East.",
  categoryCode: "museum",
  tags: ["history"],
  coordinate: [116.407387, 39.905132],
  durationMinutes: 180,
  coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
  aliases: ["国博"],
  highlights: ["Bronze gallery"],
  reviewedAt: "2026-08-30T00:00:00.000Z",
  reviewDueAt: "2026-09-29T00:00:00.000Z",
}

const recommendationResponse: PlaceRecommendationResponse = {
  results: [
    {
      placeId: "forbidden-city",
      score: 12,
      matchedSignals: ["history"],
      reason: "A strong history match with a half-day visit length.",
      reasonMode: "model",
    },
  ],
  generatedBy: "model",
  updatedAt: "2026-08-31T00:00:00.000Z",
}

function renderPanel({
  response = recommendationResponse,
  places = [palace, museum],
  candidatePlaces = places,
  selectedDay = 1,
  onAdd = vi.fn(async () => undefined),
} : {
  response?: PlaceRecommendationResponse
  places?: PlaceSummary[]
  candidatePlaces?: PlaceSummary[]
  selectedDay?: number
  onAdd?: (placeId: string, dayNumber: number) => Promise<void>
} = {}) {
  const onRecommend = vi.fn(async () => response)
  const onDetails = vi.fn()

  render(
    <RecommendationPanel
      places={places}
      candidatePlaces={candidatePlaces}
      locale="en"
      coordinate={null}
      radiusKm={null}
      availableMinutes={240}
      plannedPlaceIds={[]}
      selectedDay={selectedDay}
      onRecommend={onRecommend}
      onDetails={onDetails}
      onAdd={onAdd}
    />,
  )

  return { onRecommend, onDetails, onAdd }
}

describe("RecommendationPanel", () => {
  afterEach(cleanup)
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the send button disabled while there is no input", () => {
    renderPanel()
    expect((screen.getByRole("button", { name: "发送" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("adds a tag to the input and submits the mapped preference", async () => {
    const user = userEvent.setup()
    const { onRecommend } = renderPanel()

    await user.click(screen.getByRole("button", { name: "历史文化" }))
    expect(screen.getByRole("button", { name: "历史文化" }).getAttribute("aria-pressed")).toBe("true")
    await user.click(screen.getByRole("button", { name: "发送" }))

    expect(onRecommend).toHaveBeenCalledWith(expect.objectContaining({ preferences: ["history"] }))
  })

  it("renders the formatted answer and opens a recommended place", async () => {
    const user = userEvent.setup()
    const { onDetails } = renderPanel()

    await user.click(screen.getByRole("button", { name: "历史文化" }))
    await user.click(screen.getByRole("button", { name: "发送" }))

    expect(await screen.findByText(/根据用户输入的/)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "详情" }))
    expect(onDetails).toHaveBeenCalledWith("forbidden-city")
  })

  it("adds a recommendation to the selected day", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(async () => undefined)
    renderPanel({ selectedDay: 2, onAdd })

    await user.click(screen.getByRole("button", { name: "历史文化" }))
    await user.click(screen.getByRole("button", { name: "发送" }))
    await user.click(await screen.findByRole("button", { name: "加入第 2 天" }))

    expect(onAdd).toHaveBeenCalledWith("forbidden-city", 2)
  })
})
