import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  PlaceDetail,
  PlaceGuideResponse,
  PlaceQuestionResponse,
  PlaceSummary,
  TripDay,
} from "../../../../packages/shared/src"
import type { PlaceRepository } from "../data/placeRepository"
import { PlaceDetailPanel } from "./PlaceDetailPanel"

const place: PlaceSummary = {
  id: "forbidden-city",
  locale: "en",
  name: "The Palace Museum",
  shortIntro: "Imperial courtyards at the heart of Beijing.",
  categoryCode: "historic",
  tags: ["palace"],
  coordinate: [116.3907694, 39.9172757],
  durationMinutes: 240,
  coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
  aliases: ["Forbidden City"],
  highlights: ["Meridian Gate"],
  reviewedAt: "2026-08-30T00:00:00.000Z",
  reviewDueAt: "2026-09-29T00:00:00.000Z",
}

const detail: PlaceDetail = {
  id: place.id,
  locale: "en",
  name: place.name,
  aliases: ["Forbidden City"],
  tags: place.tags,
  shortIntro: place.shortIntro,
  history: "Home of the Ming and Qing courts.",
  highlights: ["Hall of Supreme Harmony", "Imperial Garden"],
  visitorTips: "Arrive at opening time for shorter lines.",
  practicalNotes: "Carry your passport details for ticket checks.",
  photoSpotNotes: "Morning light works best near the inner court.",
  categoryCode: place.categoryCode,
  coordinate: place.coordinate,
  durationMinutes: place.durationMinutes,
  coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
  reviewedAt: "2026-08-30T00:00:00.000Z",
  visitInformation: {
    address: "4 Jingshan Front Street, Dongcheng District, Beijing",
    openingHoursText: "Open daily except Mondays; exact hours vary by season.",
    openingHours: null,
    ticketNotes: "Reserve timed tickets in advance during peak periods.",
    bookingRequired: true,
    bookingUrl: "https://www.dpm.org.cn/",
    reservationNotes: "Foreign visitors may need passport details for booking.",
    entranceNotes: "Use Meridian Gate for the main visitor entry.",
    checkedAt: "2026-08-30T00:00:00.000Z",
    reviewDueAt: "2026-08-31T00:00:00.000Z",
    needsRecheck: true,
  },
}

const guide: PlaceGuideResponse = {
  placeId: place.id,
  locale: "en",
  audience: "general",
  segments: [
    {
      id: 1,
      type: "history",
      audience: "general",
      title: "History",
      content: "The palace remained the imperial center for almost five centuries.",
      sequence: 0,
      updatedAt: "2026-08-30T00:00:00.000Z",
    },
  ],
  sources: [
    {
      id: 1,
      name: "Palace Museum official source",
      url: "https://www.dpm.org.cn/",
      checkedAt: "2026-08-30T00:00:00.000Z",
      reviewDueAt: "2026-08-31T00:00:00.000Z",
      needsRecheck: true,
    },
  ],
}

const days: TripDay[] = [{ id: 1, dayNumber: 1, date: "2026-09-01", title: null, notes: "" }]

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function createAnswer(overrides: Partial<PlaceQuestionResponse> = {}): PlaceQuestionResponse {
  return {
    answer: "Start at Meridian Gate and look up for the layered roof details.",
    answerMode: "reviewed-local",
    generatedBy: "deterministic-retrieval",
    sources: [
      {
        id: "source-1",
        name: "Palace Museum official source",
        url: "https://www.dpm.org.cn/",
        checkedAt: "2026-08-30T00:00:00.000Z",
        reviewDueAt: "2026-08-31T00:00:00.000Z",
        needsRecheck: true,
        sourceType: "official",
      },
    ],
    searchedAt: null,
    updatedAt: "2026-08-30T00:00:00.000Z",
    dependencyStatus: "ready",
    ...overrides,
  } as PlaceQuestionResponse
}

function createRepository(answer = createAnswer()): PlaceRepository {
  return {
    listPlaces: vi.fn(),
    getPlace: vi.fn(async () => detail),
    getGuide: vi.fn(async () => guide),
    askPlace: vi.fn(async () => answer),
    recommendPlaces: vi.fn(),
  }
}

function renderPanel(repository: PlaceRepository) {
  return render(
    <PlaceDetailPanel
      place={place}
      days={days}
      planned={false}
      repository={repository}
      saved={false}
      onClose={vi.fn()}
      onAdd={vi.fn(async () => undefined)}
      onAddDay={vi.fn(async () => null)}
      onToggleSaved={vi.fn(async () => undefined)}
    />,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("PlaceDetailPanel", () => {
  it("renders reviewed detail sections, recheck warning, and clickable citations from the repository", async () => {
    const repository = createRepository()

    renderPanel(repository)

    expect(await screen.findByRole("heading", { name: "Practical notes" })).toBeTruthy()
    expect(screen.getByText("Opening information needs rechecking")).toBeTruthy()
    expect(screen.getByRole("link", { name: /Palace Museum official source/i }).getAttribute("href")).toBe("https://www.dpm.org.cn/")
  })

  it("shows an explicit unknown check-date label for guide sources with no checkedAt", async () => {
    const repository = createRepository()
    repository.getGuide = vi.fn(async () => ({
      ...guide,
      sources: [
        {
          ...guide.sources[0],
          checkedAt: null,
          reviewDueAt: "2026-09-01T00:00:00.000Z",
          needsRecheck: false,
        },
      ],
    }))

    renderPanel(repository)

    expect(await screen.findByRole("heading", { name: "Practical notes" })).toBeTruthy()
    expect(screen.getByText("Check date unavailable")).toBeTruthy()
    expect(screen.queryByText("Checked 2026-09-01")).toBeNull()
  })

  it("allows signed-out preview questions and labels reviewed answers", async () => {
    const repository = createRepository()
    const user = userEvent.setup()

    renderPanel(repository)

    await screen.findByRole("heading", { name: "Practical notes" })
    await user.type(screen.getByLabelText("Ask about this place"), "What should I notice first?")
    await user.click(screen.getByRole("button", { name: "Ask" }))

    const status = await screen.findByRole("status")
    expect(status.textContent).toContain("From reviewed information")
    expect(status.textContent).toContain("Start at Meridian Gate")
  })

  it("labels web answers, shows retrieval time, and renders every citation", async () => {
    const repository = createRepository(createAnswer({
      answerMode: "web-grounded",
      generatedBy: "web-search",
      searchedAt: "2026-08-31T10:45:00.000Z",
      warning: "Fast-changing details should be rechecked before visiting.",
      sources: [
        {
          id: "web-1",
          name: "Official visitor notice",
          url: "https://www.dpm.org.cn/notice",
          publishedAt: null,
          checkedAt: "2026-08-31T10:45:00.000Z",
          reviewDueAt: "2026-08-31T18:00:00.000Z",
          needsRecheck: true,
          sourceType: "web",
        },
        {
          id: "web-2",
          name: "Palace Museum ticket update",
          url: "https://www.dpm.org.cn/tickets",
          publishedAt: null,
          checkedAt: "2026-08-31T10:45:00.000Z",
          reviewDueAt: "2026-08-31T18:00:00.000Z",
          needsRecheck: true,
          sourceType: "official",
        },
      ],
    }))
    const user = userEvent.setup()

    renderPanel(repository)

    await screen.findByRole("heading", { name: "Practical notes" })
    await user.type(screen.getByLabelText("Ask about this place"), "What changed today?")
    await user.click(screen.getByRole("button", { name: "Ask" }))

    const status = await screen.findByRole("status")
    expect(status.textContent).toContain("Web information")
    expect(status.textContent).toContain("Retrieved 2026-08-31 10:45")
    expect(screen.getByRole("link", { name: /Official visitor notice/i }).getAttribute("href")).toBe("https://www.dpm.org.cn/notice")
    expect(screen.getByRole("link", { name: /Palace Museum ticket update/i }).getAttribute("href")).toBe("https://www.dpm.org.cn/tickets")
  })

  it.each([
    [
      "search-unavailable",
      "Online search requires the API service for questions not covered by the reviewed guide.",
    ],
    [
      "no-reliable-sources",
      "No reliable sources were found, so this answer cannot be confirmed.",
    ],
  ] as const)("renders the %s trust-mode message", async (dependencyStatus, expectedMessage) => {
    const repository = createRepository(createAnswer({
      answer: expectedMessage,
      answerMode: "unable-to-confirm",
      generatedBy: "none",
      dependencyStatus,
      sources: [],
      searchedAt: null,
      updatedAt: null,
    }))
    const user = userEvent.setup()

    renderPanel(repository)

    await screen.findByRole("heading", { name: "Practical notes" })
    await user.type(screen.getByLabelText("Ask about this place"), "Is there a live update?")
    await user.click(screen.getByRole("button", { name: "Ask" }))

    expect((await screen.findByRole("status")).textContent).toContain(expectedMessage)
  })

  it("keeps the draft question after a question request fails", async () => {
    const repository = createRepository()
    repository.askPlace = vi.fn(async () => {
      throw new Error("question failed")
    })
    const user = userEvent.setup()

    renderPanel(repository)

    await screen.findByRole("heading", { name: "Practical notes" })
    const input = screen.getByLabelText("Ask about this place")
    await user.type(input, "What should I notice first?")
    await user.click(screen.getByRole("button", { name: "Ask" }))

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("What should I notice first?")
    })
  })

  it("moves initial focus into the dialog and traps Tab navigation", async () => {
    const repository = createRepository()
    const user = userEvent.setup()

    renderPanel(repository)

    const closeButton = await screen.findByRole("button", { name: "Back" })
    expect(document.activeElement).toBe(closeButton)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Baidu Maps" }))

    await user.tab()
    expect(document.activeElement).toBe(closeButton)
  })

  it("ignores stale guide responses after the audience changes", async () => {
    const childGuide = {
      ...guide,
      audience: "child" as const,
      segments: [
        {
          id: 2,
          type: "family" as const,
          audience: "child" as const,
          title: "Family route",
          content: "Look for the guardian lions before the long courtyard walk.",
          sequence: 0,
          updatedAt: "2026-08-30T00:00:00.000Z",
        },
      ],
    }
    const generalGuideDeferred = createDeferred<PlaceGuideResponse>()
    const childGuideDeferred = createDeferred<PlaceGuideResponse>()
    const repository = createRepository()

    repository.getGuide = vi.fn((_, __, audience) => (
      audience === "child" ? childGuideDeferred.promise : generalGuideDeferred.promise
    ))

    renderPanel(repository)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Kids mode" }))

    childGuideDeferred.resolve(childGuide)
    expect(await screen.findByText("Look for the guardian lions before the long courtyard walk.")).toBeTruthy()

    generalGuideDeferred.resolve(guide)
    await waitFor(() => {
      expect(screen.queryByText("The palace remained the imperial center for almost five centuries.")).toBeNull()
    })
  })
})
