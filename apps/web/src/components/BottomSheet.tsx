import { X } from "lucide-react"
import { useEffect, type ReactNode } from "react"

type BottomSheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
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
          <button type="button" aria-label="关闭" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </section>
    </div>
  )
}
