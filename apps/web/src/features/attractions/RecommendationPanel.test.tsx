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

  it("submits chips and optional context then opens a result", async () => {
    const user = userEvent.setup()
    const { onRecommend, onDetails } = renderPanel()

    await user.click(screen.getByRole("button", { name: "History" }))
    await user.type(screen.getByLabelText("Anything else?"), "quiet morning")
    await user.click(screen.getByRole("button", { name: "Recommend places" }))

    expect(onRecommend).toHaveBeenCalledWith(expect.objectContaining({
      preferences: ["history"],
      context: "quiet morning",
    }))

    await user.click(screen.getByRole("button", { name: "View The Palace Museum" }))
    expect(onDetails).toHaveBeenCalledWith("forbidden-city")
  })

  it("toggles pressed state on preference chips", async () => {
    const user = userEvent.setup()
    renderPanel()

    const historyChip = screen.getByRole("button", { name: "History" })
    expect(historyChip.getAttribute("aria-pressed")).toBe("false")

    await user.click(historyChip)
    expect(historyChip.getAttribute("aria-pressed")).toBe("true")

    await user.click(historyChip)
    expect(historyChip.getAttribute("aria-pressed")).toBe("false")
  })

  it("shows the AI-assisted label for model responses", async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole("button", { name: "Recommend places" }))
    expect(await screen.findByText("AI-assisted recommendation")).toBeTruthy()
  })

  it("shows the reviewed-data label for deterministic responses", async () => {
    const user = userEvent.setup()
    renderPanel({
      response: {
        ...recommendationResponse,
        generatedBy: "deterministic",
      },
    })

    await user.click(screen.getByRole("button", { name: "Recommend places" }))
    expect(await screen.findByText("Reviewed-data match")).toBeTruthy()
  })

  it("adds a recommendation to the selected day", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn(async () => undefined)
    renderPanel({ selectedDay: 2, onAdd })

    await user.click(screen.getByRole("button", { name: "Recommend places" }))
    await user.click(await screen.findByRole("button", { name: "Add The Palace Museum to day 2" }))

    expect(onAdd).toHaveBeenCalledWith("forbidden-city", 2)
  })
})
