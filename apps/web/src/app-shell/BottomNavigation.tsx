import { Binoculars, Map, UserRound, Wrench, type LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"
import type { ModulePath } from "./types"

export const MODULES = [
  { path: "/attractions", label: "景点", icon: Binoculars },
  { path: "/map", label: "地图", icon: Map },
  { path: "/tools", label: "工具", icon: Wrench },
  { path: "/me", label: "我的", icon: UserRound },
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
