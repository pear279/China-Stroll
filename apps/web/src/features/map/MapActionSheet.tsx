import { Check, ExternalLink, MapPinned, Plus, X } from "lucide-react"
import { useState } from "react"
import type { PlaceSummary } from "../../../../../packages/shared/src"
import { amapSearchUrl, appleMapsUrl, googleMapsUrl } from "../../lib/navigation"

type MapActionSheetProps = {
  place: PlaceSummary
  planned: boolean
  selectedDay: number
  onDetails: () => void
  onAdd: () => Promise<void>
  onCancel: () => void
}

export function MapActionSheet({
  place,
  planned,
  selectedDay,
  onDetails,
  onAdd,
  onCancel,
}: MapActionSheetProps) {
  const [navigationExpanded, setNavigationExpanded] = useState(false)

  return (
    <section
      className="map-action-sheet"
      role="dialog"
      aria-modal="false"
      aria-label={`${place.name} map actions`}
    >
      <div className="map-action-heading">
        <div>
          <span className="eyebrow">Reviewed place</span>
          <h2>{place.name}</h2>
        </div>
        <button type="button" aria-label="Cancel" onClick={onCancel}><X aria-hidden="true" size={19} /></button>
      </div>
      <div className="map-action-buttons">
        <button type="button" onClick={onDetails}>Details</button>
        <button type="button" disabled={planned} onClick={() => void onAdd()}>
          {planned ? <Check aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}
          {planned ? "Planned" : `Add to day ${selectedDay}`}
        </button>
        <button type="button" onClick={() => setNavigationExpanded((current) => !current)}>
          <MapPinned aria-hidden="true" size={16} />Navigate
        </button>
      </div>
      {navigationExpanded && (
        <nav className="navigation-links" aria-label="Choose navigation provider">
          <a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">
            Apple Maps <ExternalLink aria-hidden="true" size={14} />
          </a>
          <a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">
            Google Maps <ExternalLink aria-hidden="true" size={14} />
          </a>
          <a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">
            Amap <ExternalLink aria-hidden="true" size={14} />
          </a>
        </nav>
      )}
    </section>
  )
}
