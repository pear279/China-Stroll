import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
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

describe("RecommendationPanel", () => {
  it("submits chips and optional context then opens a result", async () => {
    const user = userEvent.setup()
    const onRecommend = vi.fn(async () => recommendationResponse)
    const onDetails = vi.fn()

    render(
      <RecommendationPanel
        places={[palace, museum]}
        locale="en"
        coordinate={null}
        radiusKm={null}
        availableMinutes={240}
        plannedPlaceIds={[]}
        selectedDay={1}
        onRecommend={onRecommend}
        onDetails={onDetails}
        onAdd={vi.fn(async () => undefined)}
      />,
    )

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
})
