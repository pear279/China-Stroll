import { X } from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { useLocale } from "../lib/i18n"

type BottomSheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const { t } = useLocale()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="bottom-sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="bottom-sheet-handle" aria-hidden="true" />
        <div className="bottom-sheet-heading">
          <h2>{title}</h2>
          <button type="button" aria-label={t("common.close")} onClick={onClose}><X size={18} /></button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </section>
    </div>
  )
}
