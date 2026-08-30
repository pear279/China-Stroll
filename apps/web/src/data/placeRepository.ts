import type {
  Locale,
  PlaceDetail,
  PlaceGuideResponse,
  PlaceListResponse,
  PlaceQuestionRequest,
  PlaceQuestionResponse,
  PlaceRecommendationInput,
  PlaceRecommendationResponse,
} from "../../../../packages/shared/src"
import { ApiPlaceRepository } from "./apiPlaceRepository"
import { PlaceDependencyError, StaticPlaceRepository } from "./staticPlaceRepository"

export type GuideAudience = "general" | "child"

export type PlaceListFilters = {
  locale?: Locale
  category?: string
  maxDurationMinutes?: number
}

export interface PlaceRepository {
  listPlaces(filters?: PlaceListFilters): Promise<PlaceListResponse>
  getPlace(placeId: string, locale?: Locale): Promise<PlaceDetail>
  getGuide(placeId: string, locale?: Locale, audience?: GuideAudience): Promise<PlaceGuideResponse>
  askPlace(input: PlaceQuestionRequest): Promise<PlaceQuestionResponse>
  recommendPlaces(input: PlaceRecommendationInput): Promise<PlaceRecommendationResponse>
}

export type PlaceDependencyErrorCode = "catalog-unavailable" | "search-unavailable" | "ai-unavailable"

export function createPlaceRepository(mode: "static"): PlaceRepository
export function createPlaceRepository(mode: "api", accessToken: string | null): PlaceRepository
export function createPlaceRepository(mode: "static" | "api", accessToken: string | null = null): PlaceRepository {
  return mode === "static"
    ? new StaticPlaceRepository()
    : new ApiPlaceRepository(accessToken)
}

export { ApiPlaceRepository, PlaceDependencyError, StaticPlaceRepository }
