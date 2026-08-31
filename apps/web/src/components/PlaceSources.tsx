import { ExternalLink } from "lucide-react"
import type { PlaceSourceCitation } from "../../../../packages/shared/src"

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

export function PlaceSources({ sources }: { sources: PlaceSourceCitation[] }) {
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
          <small>{source.needsRecheck ? "Recheck before visiting" : `Checked ${formatReviewDate(source.checkedAt)}`}</small>
        </li>
      ))}
    </ul>
  )
}
