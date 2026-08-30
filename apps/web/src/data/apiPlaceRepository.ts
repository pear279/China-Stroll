import type {
  Locale,
  PlaceDetail,
  PlaceGuideResponse,
  PlaceQuestionRequest,
  PlaceRecommendationInput,
} from "../../../../packages/shared/src"
import { api } from "../lib/api"
import type { GuideAudience, PlaceListFilters, PlaceRepository } from "./placeRepository"

export class ApiPlaceRepository implements PlaceRepository {
  constructor(private readonly accessToken: string | null) {}

  listPlaces(filters: PlaceListFilters = {}) {
    return api.listPlaces(filters)
  }

  getPlace(placeId: string, locale: Locale = "en"): Promise<PlaceDetail> {
    return api.getPlace(placeId, locale)
  }

  getGuide(
    placeId: string,
    locale: Locale = "en",
    audience: GuideAudience = "general",
  ): Promise<PlaceGuideResponse> {
    return api.getPlaceGuide(placeId, locale, audience)
  }

  askPlace(input: PlaceQuestionRequest) {
    return api.askPlace(this.accessToken, input)
  }

  recommendPlaces(input: PlaceRecommendationInput) {
    return api.recommendPlaces(this.accessToken, input)
  }
}
