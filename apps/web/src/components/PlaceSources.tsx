import { ExternalLink } from "lucide-react"
import type { PlaceSourceCitation } from "../../../../packages/shared/src"

export type PlaceDisplaySource = Omit<PlaceSourceCitation, "checkedAt"> & {
  checkedAt: string | null
}

function formatReviewDate(value: string | null) {
  return value ? value.slice(0, 10) : "date unavailable"
}

function sourceTypeLabel(sourceType: PlaceSourceCitation["sourceType"]) {
  switch (sourceType) {
    case "official":
      return "Official source"
    case "web":
      return "Web source"
    default:
      return "Reviewed reference"
  }
}

function sourceStatusLabel(source: PlaceDisplaySource) {
  if (!source.checkedAt) {
    return source.needsRecheck
      ? "Check date unavailable; recheck before visiting"
      : "Check date unavailable"
  }
  return source.needsRecheck ? "Recheck before visiting" : `Checked ${formatReviewDate(source.checkedAt)}`
}

export function PlaceSources({ sources }: { sources: PlaceDisplaySource[] }) {
  return (
    <ul className="place-sources">
      {sources.map((source) => (
        <li key={source.id} className="place-source-card">
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer">
              <span>{source.name}</span>
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          ) : (
            <span className="place-source-name">{source.name}</span>
          )}
          <span className="place-source-type">{sourceTypeLabel(source.sourceType)}</span>
          <small>{sourceStatusLabel(source)}</small>
        </li>
      ))}
    </ul>
  )
}
