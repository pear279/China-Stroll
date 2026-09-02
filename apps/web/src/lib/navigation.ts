import type { Coordinate } from "../../../../packages/shared/src"

function coordinateText(coordinate: Coordinate) {
  return `${coordinate[1]},${coordinate[0]}`
}

export function appleMapsUrl(name: string, coordinate: Coordinate) {
  const query = new URLSearchParams({ daddr: coordinateText(coordinate), q: name, dirflg: "w" })
  return `https://maps.apple.com/?${query.toString()}`
}

export function googleMapsUrl(name: string, coordinate: Coordinate) {
  const query = new URLSearchParams({ api: "1", destination: `${name} ${coordinateText(coordinate)}`, travelmode: "walking" })
  return `https://www.google.com/maps/dir/?${query.toString()}`
}

export function amapSearchUrl(name: string) {
  const query = new URLSearchParams({ keywords: name, city: "北京", sourceApplication: "China Stroll" })
  return `https://uri.amap.com/search?${query.toString()}`
}

// Baidu Maps uses its own BD09 coordinate system, so like Amap we search by
// name instead of passing a WGS84 coordinate directly.
export function baiduMapsUrl(name: string) {
  const query = new URLSearchParams({ query: name, src: "China Stroll" })
  return `https://map.baidu.com/search?${query.toString()}`
}

// Opens the ride-hailing provider's site or app. China Stroll does not create a
// booking, so this is a plain external link with no ride-request claim.
export function didiWebUrl() {
  return "https://www.didiglobal.com/"
}

export function haversineKilometres(from: Coordinate, to: Coordinate) {
  const radians = (value: number) => value * Math.PI / 180
  const deltaLat = radians(to[1] - from[1])
  const deltaLng = radians(to[0] - from[0])
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(deltaLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
