#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const curatedPath = path.join(root, "data/curated/first-20-places.json")
const displayManifestPath = path.join(root, "apps/web/public/places/manifest.json")
const outputPath = path.join(root, "apps/web/public/data/places-v1.json")

const locales = ["en", "zh-CN"]

function sourceCitation(place, source, checkedAt, reviewDueAt) {
  const sourceCheckedAt = source.checkedAt ?? checkedAt
  const sourceReviewDueAt = source.reviewDueAt ?? reviewDueAt
  if (!source.url.startsWith("https://")) {
    throw new Error(`Source URL must use HTTPS for ${place.id}:${source.key}`)
  }

  return {
    id: `${place.id}:${source.key}`,
    name: source.name,
    url: source.url,
    publisher: source.name,
    publishedAt: null,
    checkedAt: sourceCheckedAt,
    reviewDueAt: sourceReviewDueAt,
    needsRecheck: Date.parse(sourceReviewDueAt) <= Date.parse(checkedAt),
    sourceType: source.type === "official" ? "official" : "reviewed-reference",
  }
}

function buildSearchDocuments(place, localization, segments, sourceIds, checkedAt) {
  return [
    {
      id: `${place.id}:${localization.locale}:overview`,
      section: "overview",
      content: [
        localization.name,
        localization.shortIntro,
        localization.history,
        localization.highlights.join("\n"),
      ].join("\n"),
      sourceIds,
      updatedAt: checkedAt,
    },
    {
      id: `${place.id}:${localization.locale}:visit`,
      section: "visit",
      content: [
        localization.visitorTips,
        localization.practicalNotes,
        localization.photoSpotNotes,
      ].join("\n"),
      sourceIds,
      updatedAt: checkedAt,
    },
    {
      id: `${place.id}:${localization.locale}:guide`,
      section: "guide",
      content: segments.map((segment) => segment.content).join("\n"),
      sourceIds,
      updatedAt: checkedAt,
    },
  ]
}

function localeEntry(place, locale, metadata, displayImage) {
  const localization = place.localizations.find((item) => item.locale === locale)
  if (!localization) throw new Error(`Missing ${locale} localization for ${place.id}`)
  const visit = place.visitInformation.find((item) => item.locale === locale) ?? null
  const sources = place.sources.map((source) =>
    sourceCitation(place, source, metadata.checkedAt, metadata.reviewDueAt),
  )
  const segments = place.guides
    .filter((guide) => guide.locale === locale)
    .map((guide, index) => ({
      id: index + 1,
      type: guide.segmentType,
      audience: guide.audience,
      title: guide.title,
      content: guide.content,
      sequence: guide.sequence,
      updatedAt: metadata.checkedAt,
    }))

  const coordinate = place.coordinate
  const summary = {
    id: place.id,
    locale,
    name: localization.name,
    shortIntro: localization.shortIntro,
    categoryCode: place.categoryCode,
    tags: localization.tags,
    coordinate: [coordinate.longitude, coordinate.latitude],
    durationMinutes: place.durationMinutes,
    coordinatesCheckedAt: coordinate.checkedAt ?? null,
    aliases: localization.aliases,
    highlights: localization.highlights,
    reviewedAt: localization.reviewedAt ?? metadata.checkedAt,
    reviewDueAt: localization.reviewDueAt ?? metadata.reviewDueAt,
  }

  const detail = {
    id: place.id,
    locale,
    name: localization.name,
    aliases: localization.aliases,
    tags: localization.tags,
    shortIntro: localization.shortIntro,
    history: localization.history,
    highlights: localization.highlights,
    visitorTips: localization.visitorTips,
    practicalNotes: localization.practicalNotes,
    photoSpotNotes: localization.photoSpotNotes,
    categoryCode: place.categoryCode,
    coordinate: [coordinate.longitude, coordinate.latitude],
    durationMinutes: place.durationMinutes,
    coordinatesCheckedAt: coordinate.checkedAt ?? null,
    reviewedAt: localization.reviewedAt ?? metadata.checkedAt,
    visitInformation: visit
      ? {
          ...visit,
          checkedAt: visit.checkedAt ?? metadata.checkedAt,
          reviewDueAt: visit.reviewDueAt ?? metadata.reviewDueAt,
          needsRecheck:
            Date.parse(visit.reviewDueAt ?? metadata.reviewDueAt) <= Date.parse(metadata.checkedAt),
        }
      : null,
  }

  return {
    summary,
    detail,
    guides: {
      placeId: place.id,
      locale,
      general: segments.filter((segment) => segment.audience === "general"),
      child: segments.filter((segment) => segment.audience === "child"),
      sources,
    },
    searchDocuments: buildSearchDocuments(
      place,
      localization,
      segments,
      sources.map((source) => source.id),
      metadata.checkedAt,
    ),
    displayImage,
  }
}

function getManifestImages(manifest) {
  if (!manifest || !Array.isArray(manifest.images)) {
    throw new Error("Display image manifest is missing its images array")
  }
  return new Map(manifest.images.map((image) => [image.placeId, image]))
}

function validateInputs(curated, manifestImages) {
  if (!Array.isArray(curated.places) || curated.places.length !== 20) {
    throw new Error("Curated package must contain exactly 20 places")
  }
  const ids = new Set(curated.places.map((place) => place.id))
  if (ids.size !== curated.places.length) throw new Error("Curated package place IDs must be unique")

  for (const place of curated.places) {
    const image = manifestImages.get(place.id)
    if (!image) throw new Error(`Missing display illustration for ${place.id}`)
    if (!image.output?.startsWith("/places/")) {
      throw new Error(`Display illustration must be a /places path for ${place.id}`)
    }
    for (const source of place.sources) {
      if (!source.url.startsWith("https://")) {
        throw new Error(`Source URL must use HTTPS for ${place.id}:${source.key}`)
      }
    }
  }
}

function buildCatalog(curated, manifest) {
  const metadata = {
    version: curated.version,
    checkedAt: curated.checkedAt,
    reviewDueAt: curated.reviewDueAt,
  }
  const manifestImages = getManifestImages(manifest)
  validateInputs(curated, manifestImages)
  return {
    version: metadata.version,
    checkedAt: metadata.checkedAt,
    reviewDueAt: metadata.reviewDueAt,
    locales: {
      en: curated.places.map((place) =>
        localeEntry(place, "en", metadata, manifestImages.get(place.id).output),
      ),
      "zh-CN": curated.places.map((place) =>
        localeEntry(place, "zh-CN", metadata, manifestImages.get(place.id).output),
      ),
    },
  }
}

function validateCatalog(catalog, curated, manifest) {
  if (!catalog || catalog.version !== curated.version) throw new Error("Catalog version does not match curated package")
  if (catalog.checkedAt !== curated.checkedAt || catalog.reviewDueAt !== curated.reviewDueAt) {
    throw new Error("Catalog review metadata does not match curated package")
  }
  const manifestImages = getManifestImages(manifest)
  const expectedIds = curated.places.map((place) => place.id)
  for (const locale of locales) {
    const entries = catalog.locales?.[locale]
    if (!Array.isArray(entries) || entries.length !== 20) {
      throw new Error(`Catalog must contain 20 ${locale} entries`)
    }
    const ids = entries.map((entry) => entry.summary?.id)
    if (new Set(ids).size !== 20 || ids.some((id, index) => id !== expectedIds[index])) {
      throw new Error(`Catalog ${locale} IDs must match the curated package exactly once`)
    }
    for (const entry of entries) {
      if (entry.summary.locale !== locale) throw new Error(`Catalog locale mismatch for ${entry.summary.id}`)
      const image = manifestImages.get(entry.summary.id)
      if (!image || entry.displayImage !== image.output) {
        throw new Error(`Catalog image mapping is not in the display manifest for ${entry.summary.id}`)
      }
      for (const source of entry.guides.sources) {
        if (!source.url.startsWith("https://")) throw new Error(`Catalog source URL must use HTTPS for ${source.id}`)
      }
    }
  }
}

async function loadInputs() {
  const [curated, manifest] = await Promise.all([
    readFile(curatedPath, "utf8").then(JSON.parse),
    readFile(displayManifestPath, "utf8").then(JSON.parse),
  ])
  return { curated, manifest }
}

async function main() {
  const command = process.argv[2]
  if (command !== "build" && command !== "verify") {
    throw new Error("Usage: node scripts/build_place_catalog.mjs <build|verify>")
  }

  const { curated, manifest } = await loadInputs()
  const catalog = buildCatalog(curated, manifest)
  const expectedText = `${JSON.stringify(catalog, null, 2)}\n`

  if (command === "build") {
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, expectedText, "utf8")
    console.log(`Wrote ${path.relative(root, outputPath)} (${catalog.locales.en.length} English, ${catalog.locales["zh-CN"].length} Chinese entries)`)
    return
  }

  const actualText = await readFile(outputPath, "utf8")
  if (actualText !== expectedText) throw new Error("Committed browser catalog is out of date; run catalog:prepare")
  validateCatalog(JSON.parse(actualText), curated, manifest)
  console.log(`Catalog verified: ${catalog.locales.en.length} English and ${catalog.locales["zh-CN"].length} Chinese entries`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
