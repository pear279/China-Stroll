import type { TranslationKey } from "../../lib/i18n"

// The traveler title is a single-select badge shown on the Mine profile card.
// It is stored client-side as a stable id (see `ProfileExtras`) until the user
// data structure gains a persisted field; the display string stays in i18n.
export const TRAVELER_TITLES = ["culture", "family", "food", "slow", "city"] as const
export type TravelerTitle = (typeof TRAVELER_TITLES)[number]

const TITLE_KEYS: Record<TravelerTitle, TranslationKey> = {
  culture: "mine.title.culture",
  family: "mine.title.family",
  food: "mine.title.food",
  slow: "mine.title.slow",
  city: "mine.title.city",
}

export function travelerTitleKey(title: TravelerTitle | null | undefined): TranslationKey {
  return title ? TITLE_KEYS[title] : "mine.title.culture"
}

export function isTravelerTitle(value: string | null | undefined): value is TravelerTitle {
  return value != null && (TRAVELER_TITLES as readonly string[]).includes(value)
}
