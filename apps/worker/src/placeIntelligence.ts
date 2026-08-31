import type { Locale, PlaceQuestionResponse, PlaceSourceCitation } from "../../../packages/shared/src"
import type { WebSearchProvider } from "./webSearch"

export type ReviewedPlaceDocument = {
  id: string
  section: string
  content: string
  sourceIds: string[]
  updatedAt: string
}

function tokens(value: string) {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []
}

function unableToConfirm(dependencyStatus: "search-unavailable" | "no-reliable-sources"): PlaceQuestionResponse {
  return {
    answer: "The available reviewed guide cannot confirm this yet.",
    answerMode: "unable-to-confirm",
    generatedBy: "none",
    sources: [],
    sourceIds: [],
    searchedAt: null,
    dependencyStatus,
    updatedAt: null,
  }
}

export async function answerPlaceQuestion(input: {
  placeName: string
  question: string
  locale: Locale
  documents: ReviewedPlaceDocument[]
  sources: PlaceSourceCitation[]
  search?: WebSearchProvider
}): Promise<PlaceQuestionResponse> {
  const queryTokens = new Set(tokens(input.question))
  const ranked = input.documents
    .map((document) => ({
      document,
      score: tokens(`${document.section} ${document.content}`).filter((token) => queryTokens.has(token)).length,
    }))
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))
  const local = ranked[0]
  const sourceById = new Map(input.sources.map((source) => [source.id, source]))
  const localSources = local ? local.document.sourceIds.flatMap((id) => sourceById.get(id) ?? []) : []
  if (local && local.score >= 1 && localSources.length > 0) {
    return {
      answer: local.document.content,
      answerMode: "reviewed-local",
      generatedBy: "deterministic-retrieval",
      sources: localSources,
      sourceIds: localSources.map((source) => Number(source.id)).filter(Number.isInteger),
      searchedAt: null,
      dependencyStatus: "ready",
      updatedAt: local.document.updatedAt,
    }
  }
  if (!input.search) return unableToConfirm("search-unavailable")
  try {
    const web = await input.search.search(`${input.placeName} ${input.question}`, input.locale)
    return {
      answer: web.answer,
      answerMode: "web-grounded",
      generatedBy: "web-search",
      sources: web.sources,
      searchedAt: web.searchedAt,
      dependencyStatus: "ready",
      updatedAt: null,
      warning: "Web information can change; verify time-sensitive details with the linked source.",
    }
  } catch (error) {
    return unableToConfirm(error instanceof Error && error.message === "web_search_no_reliable_sources" ? "no-reliable-sources" : "search-unavailable")
  }
}
