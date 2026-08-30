import {
  filterPlaceSummaries,
  findReviewedAnswer,
  placeCatalogSchema,
  rankPlaceRecommendations,
  type PlaceCatalog,
  type PlaceCatalogEntry,
  type PlaceDetail,
  type PlaceGuideResponse,
  type PlaceQuestionRequest,
  type PlaceQuestionResponse,
  type PlaceRecommendationInput,
  type PlaceRecommendationResponse,
} from "../../../../packages/shared/src"
import { isReviewOverdue } from "../../../worker/src/contracts"
import { api, ApiRequestError } from "../lib/api"
import type {
  GuideAudience,
  PlaceDependencyErrorCode,
  PlaceListFilters,
  PlaceRepository,
} from "./placeRepository"

type CatalogFetcher = () => Promise<Response>
type AskPlaceOnline = (input: PlaceQuestionRequest) => Promise<PlaceQuestionResponse>
type RecommendPlacesOnline = (input: PlaceRecommendationInput) => Promise<PlaceRecommendationResponse>

function defaultCatalogFetcher() {
  return fetch("/data/places-v1.json", {
    headers: { "Content-Type": "application/json" },
  })
}

function defaultAskPlaceOnline(input: PlaceQuestionRequest) {
  return api.askPlace(null, input)
}

function defaultRecommendPlacesOnline(input: PlaceRecommendationInput) {
  return api.recommendPlaces(null, input)
}

function refreshGuideSources(entry: PlaceCatalogEntry) {
  return entry.guides.sources.map((source) => ({
    ...source,
    needsRecheck: isReviewOverdue(source.reviewDueAt),
  }))
}

function toGuideSources(entry: PlaceCatalogEntry) {
  return entry.guides.sources.map((source, index) => ({
    id: index + 1,
    name: source.name,
    url: source.url,
    checkedAt: source.checkedAt,
    reviewDueAt: source.reviewDueAt,
    needsRecheck: source.needsRecheck,
  }))
}

function refreshVisitInformation(detail: PlaceDetail): PlaceDetail {
  if (!detail.visitInformation) {
    return detail
  }

  return {
    ...detail,
    visitInformation: {
      ...detail.visitInformation,
      needsRecheck: isReviewOverdue(detail.visitInformation.reviewDueAt),
    },
  }
}

function refreshCatalog(catalog: PlaceCatalog): PlaceCatalog {
  return {
    ...catalog,
    locales: {
      en: catalog.locales.en.map((entry) => ({
        ...entry,
        detail: refreshVisitInformation(entry.detail),
        guides: {
          ...entry.guides,
          sources: refreshGuideSources(entry),
        },
      })),
      "zh-CN": catalog.locales["zh-CN"].map((entry) => ({
        ...entry,
        detail: refreshVisitInformation(entry.detail),
        guides: {
          ...entry.guides,
          sources: refreshGuideSources(entry),
        },
      })),
    },
  }
}

function findCatalogEntry(catalog: PlaceCatalog, placeId: string, locale: "en" | "zh-CN") {
  return catalog.locales[locale].find((entry) => entry.summary.id === placeId) ?? null
}

function notFound(message: string) {
  return new ApiRequestError(message, "NOT_FOUND", 404)
}

function isDependencyFailure(error: unknown) {
  return error instanceof TypeError
    || error instanceof PlaceDependencyError
    || (error instanceof ApiRequestError && error.code === "DEPENDENCY_UNAVAILABLE")
}

export class PlaceDependencyError extends Error {
  readonly apiCode: string | null
  readonly apiStatus: number | null

  constructor(
    message: string,
    readonly code: PlaceDependencyErrorCode,
    options: {
      cause?: unknown
      apiCode?: string | null
      apiStatus?: number | null
    } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "PlaceDependencyError"
    this.apiCode = options.apiCode ?? null
    this.apiStatus = options.apiStatus ?? null
  }
}

function wrapApiDependencyError(error: unknown, code: PlaceDependencyErrorCode) {
  if (error instanceof PlaceDependencyError) {
    return error
  }
  if (error instanceof ApiRequestError) {
    return new PlaceDependencyError(error.message, code, {
      cause: error,
      apiCode: error.code,
      apiStatus: error.status,
    })
  }
  if (error instanceof Error) {
    return new PlaceDependencyError(error.message, code, { cause: error })
  }
  return new PlaceDependencyError("The place service is temporarily unavailable.", code, { cause: error })
}

export class StaticPlaceRepository implements PlaceRepository {
  private readonly catalogPromise: Promise<PlaceCatalog>

  constructor(
    private readonly fetchCatalog: CatalogFetcher = defaultCatalogFetcher,
    private readonly askOnline: AskPlaceOnline = defaultAskPlaceOnline,
    private readonly recommendOnline: RecommendPlacesOnline = defaultRecommendPlacesOnline,
  ) {
    this.catalogPromise = this.loadCatalog()
  }

  async listPlaces(filters: PlaceListFilters = {}) {
    const locale = filters.locale ?? "en"
    const catalog = await this.catalogPromise
    return {
      locale,
      places: filterPlaceSummaries(
        catalog.locales[locale].map((entry) => entry.summary),
        {
          query: "",
          category: filters.category ?? "all",
          maxDurationMinutes: filters.maxDurationMinutes,
        },
      ),
    }
  }

  async getPlace(placeId: string, locale: "en" | "zh-CN" = "en") {
    const entry = findCatalogEntry(await this.catalogPromise, placeId, locale)
    if (!entry) {
      throw notFound("Place not found.")
    }
    return entry.detail
  }

  async getGuide(placeId: string, locale: "en" | "zh-CN" = "en", audience: GuideAudience = "general") {
    const entry = findCatalogEntry(await this.catalogPromise, placeId, locale)
    if (!entry) {
      throw notFound("Guide not found.")
    }

    return {
      placeId,
      locale,
      audience,
      segments: audience === "child" ? entry.guides.child : entry.guides.general,
      sources: toGuideSources(entry),
    } satisfies PlaceGuideResponse
  }

  async askPlace(input: PlaceQuestionRequest) {
    const entry = findCatalogEntry(await this.catalogPromise, input.placeId, input.locale)
    if (!entry) {
      throw notFound("Place not found.")
    }

    const reviewed = findReviewedAnswer(entry, input.question)
    if (reviewed) {
      return reviewed
    }

    try {
      return await this.askOnline(input)
    } catch (error) {
      if (!isDependencyFailure(error)) {
        throw error
      }
      return {
        answer: "We could not confirm that with reviewed or live sources right now.",
        answerMode: "unable-to-confirm",
        generatedBy: "none",
        sources: [],
        searchedAt: null,
        updatedAt: null,
        dependencyStatus: "search-unavailable",
      } satisfies PlaceQuestionResponse
    }
  }

  async recommendPlaces(input: PlaceRecommendationInput) {
    const catalog = await this.catalogPromise
    try {
      return await this.recommendOnline(input)
    } catch (error) {
      if (!isDependencyFailure(error)) {
        throw error
      }
      return {
        results: rankPlaceRecommendations(
          catalog.locales[input.locale].map((entry) => entry.summary),
          input,
        ),
        generatedBy: "deterministic",
        updatedAt: new Date().toISOString(),
      } satisfies PlaceRecommendationResponse
    }
  }

  private async loadCatalog() {
    try {
      const response = await this.fetchCatalog()
      if (!response.ok) {
        throw new ApiRequestError(
          "The place catalog is temporarily unavailable.",
          "DEPENDENCY_UNAVAILABLE",
          response.status,
        )
      }
      const payload = await response.json()
      return refreshCatalog(placeCatalogSchema.parse(payload))
    } catch (error) {
      throw wrapApiDependencyError(error, "catalog-unavailable")
    }
  }
}
