import { Binoculars, Map, UserRound, Wrench, type LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"
import type { ModulePath } from "./types"

export const MODULES = [
  { path: "/attractions", label: "Attractions", icon: Binoculars },
  { path: "/map", label: "Map", icon: Map },
  { path: "/tools", label: "Tools", icon: Wrench },
  { path: "/me", label: "Mine", icon: UserRound },
] as const satisfies readonly { path: ModulePath; label: string; icon: LucideIcon }[]

export function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Primary">
      {MODULES.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) => (isActive ? "is-active" : undefined)}
        >
          {({ isActive }) => (
            <>
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
              {isActive && <span className="sr-only">Current page</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
