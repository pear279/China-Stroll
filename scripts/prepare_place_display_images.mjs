#!/usr/bin/env node

import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import sharp from "sharp"

const projectRoot = process.cwd()
const sourceDirectory = path.join(projectRoot, "data/processed/place-display-images")
const placeDataPath = path.join(projectRoot, "data/processed/places.zh-CN.json")
const publicDirectory = path.join(projectRoot, "apps/web/public/places")
const manifestPath = path.join(publicDirectory, "manifest.json")
const imageSize = 960
const webpQuality = 82

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function sourceId(filename) {
  const match = filename.match(/^(.+)-stamp-square\.(?:png|jpe?g)$/i)
  if (!match) return null
  return match[1]
}

function placeIdFromSource(sourcePlaceId) {
  return sourcePlaceId === "palace-museum" ? "forbidden-city" : sourcePlaceId
}

async function loadExpectedPlaceIds() {
  const places = JSON.parse(await readFile(placeDataPath, "utf8"))
  const ids = places.map((place) => place.id).sort()
  if (ids.length !== 52 || new Set(ids).size !== ids.length) {
    throw new Error(`Expected 52 unique place ids, found ${ids.length}`)
  }
  return ids
}

async function loadSourceImages() {
  const filenames = (await readdir(sourceDirectory)).filter((filename) => sourceId(filename)).sort()
  const records = filenames.map((filename) => {
    const displaySourceId = sourceId(filename)
    return {
      filename,
      displaySourceId,
      placeId: placeIdFromSource(displaySourceId),
    }
  })
  const ids = records.map((record) => record.placeId)
  if (records.length !== 52 || new Set(ids).size !== ids.length) {
    throw new Error(`Expected 52 uniquely mapped display images, found ${records.length}`)
  }
  return records
}

async function build() {
  const [expectedPlaceIds, records] = await Promise.all([loadExpectedPlaceIds(), loadSourceImages()])
  const mappedPlaceIds = records.map((record) => record.placeId).sort()
  if (JSON.stringify(expectedPlaceIds) !== JSON.stringify(mappedPlaceIds)) {
    const missing = expectedPlaceIds.filter((id) => !mappedPlaceIds.includes(id))
    const extra = mappedPlaceIds.filter((id) => !expectedPlaceIds.includes(id))
    throw new Error(`Display image mapping mismatch; missing=${missing.join(",")}; extra=${extra.join(",")}`)
  }

  await rm(publicDirectory, { recursive: true, force: true })
  await mkdir(publicDirectory, { recursive: true })

  const manifest = []
  for (const record of records) {
    const sourcePath = path.join(sourceDirectory, record.filename)
    const outputFilename = `${record.placeId}.webp`
    const outputPath = path.join(publicDirectory, outputFilename)
    const sourceBuffer = await readFile(sourcePath)
    const outputBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize(imageSize, imageSize, { fit: "cover", position: "centre" })
      .webp({ quality: webpQuality, effort: 6 })
      .toBuffer()
    await writeFile(outputPath, outputBuffer)
    manifest.push({
      placeId: record.placeId,
      source: `data/processed/place-display-images/${record.filename}`,
      output: `/places/${outputFilename}`,
      sourceSha256: sha256(sourceBuffer),
      outputSha256: sha256(outputBuffer),
      width: imageSize,
      height: imageSize,
      format: "webp",
    })
  }
  manifest.sort((left, right) => left.placeId.localeCompare(right.placeId))
  await writeFile(manifestPath, `${JSON.stringify({ version: 1, images: manifest }, null, 2)}\n`)
  console.log(`Prepared ${manifest.length} display illustrations in ${publicDirectory}`)
}

async function verify() {
  const payload = JSON.parse(await readFile(manifestPath, "utf8"))
  if (payload.version !== 1 || !Array.isArray(payload.images) || payload.images.length !== 52) {
    throw new Error("Display image manifest must contain exactly 52 version-1 records")
  }

  const expectedFiles = new Set(["manifest.json"])
  const seenPlaceIds = new Set()
  for (const record of payload.images) {
    if (seenPlaceIds.has(record.placeId)) throw new Error(`Duplicate display image for ${record.placeId}`)
    seenPlaceIds.add(record.placeId)
    const outputFilename = `${record.placeId}.webp`
    const outputPath = path.join(publicDirectory, outputFilename)
    expectedFiles.add(outputFilename)
    const outputBuffer = await readFile(outputPath)
    const metadata = await sharp(outputBuffer).metadata()
    if (metadata.format !== "webp" || metadata.width !== imageSize || metadata.height !== imageSize) {
      throw new Error(`Invalid generated image metadata for ${record.placeId}`)
    }
    if (sha256(outputBuffer) !== record.outputSha256) {
      throw new Error(`Generated image hash mismatch for ${record.placeId}`)
    }
  }

  const actualFiles = new Set((await readdir(publicDirectory)).filter((filename) => filename !== ".DS_Store"))
  const unexpected = [...actualFiles].filter((filename) => !expectedFiles.has(filename))
  const missing = [...expectedFiles].filter((filename) => !actualFiles.has(filename))
  if (unexpected.length || missing.length) {
    throw new Error(`Public place assets mismatch; missing=${missing.join(",")}; unexpected=${unexpected.join(",")}`)
  }

  for (const filename of actualFiles) {
    const info = await stat(path.join(publicDirectory, filename))
    if (!info.isFile()) throw new Error(`Unexpected non-file place asset: ${filename}`)
  }
  console.log(`Verified ${payload.images.length} display illustrations; no photograph-format fallback assets found`)
}

const command = process.argv[2] ?? "verify"
if (command === "build") await build()
else if (command === "verify") await verify()
else throw new Error(`Unknown command ${command}; use build or verify`)
