import { forwardRef, useImperativeHandle } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { SharedMemberLocation } from "../../../../packages/shared/src"
import { TravelMap } from "./TravelMap"

vi.mock("../../../../components/ui/map", () => ({
  Map: forwardRef(function TestMap({ children }: { children: React.ReactNode }, ref) {
    useImperativeHandle(ref, () => ({ flyTo: vi.fn() }))
    return <div aria-label="Test map canvas">{children}</div>
  }),
  MapMarker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MapRoute: () => <div>Visit-order line</div>,
  MarkerContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const memberPoint: SharedMemberLocation = {
  userId: "user-alex",
  displayName: "Alex",
  initials: "A",
  coordinate: [116.397, 39.908],
  updatedAt: "2099-09-01T10:00:00.000Z",
  expiresAt: "2099-09-01T10:10:00.000Z",
}

afterEach(cleanup)

describe("TravelMap", () => {
  it("renders a distinct current-point marker for a visible trip member", () => {
    render(
      <TravelMap
        memberLocations={[memberPoint]}
        onSelect={vi.fn()}
        places={[]}
        selectedPlaceId={null}
        stops={[]}
        userCoordinate={null}
      />,
    )

    expect(screen.getByLabelText("Alex’s shared current location")).toBeTruthy()
    expect(screen.getByText("A")).toBeTruthy()
    expect(screen.queryByText("Route history")).toBeNull()
    expect(screen.queryByText("Visit-order line")).toBeNull()
  })
})
