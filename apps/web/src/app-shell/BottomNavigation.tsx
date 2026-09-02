import { Binoculars, Map, UserRound, Wrench, type LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"
import { useLocale, type TranslationKey } from "../lib/i18n"
import type { ModulePath } from "./types"

const MODULE_KEYS = [
  { path: "/attractions", key: "nav.attractions", icon: Binoculars },
  { path: "/map", key: "nav.map", icon: Map },
  { path: "/tools", key: "nav.tools", icon: Wrench },
  { path: "/me", key: "nav.mine", icon: UserRound },
] as const satisfies readonly { path: ModulePath; key: TranslationKey; icon: LucideIcon }[]

export function BottomNavigation() {
  const { t } = useLocale()
  return (
    <nav className="bottom-navigation" aria-label="Primary">
      {MODULE_KEYS.map(({ path, key, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) => (isActive ? "is-active" : undefined)}
        >
          {({ isActive }) => (
            <>
              <Icon aria-hidden="true" size={20} />
              <span>{t(key)}</span>
              {isActive && <span className="sr-only">Current page</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
