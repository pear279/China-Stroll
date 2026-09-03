// The China Stroll brand mark, kept pixel-identical to the favicon/app icon
// (`public/icon.svg`). It is the cream mountain + gold sun glyph; the red
// rounded tile is provided by the surrounding `.brand-seal` element so the
// in-app logo, the browser tab favicon and the installable app icon all read
// as one visual system.
export function BrandMark() {
  return (
    <svg className="brand-seal-mark" viewBox="0 0 512 512" fill="none" aria-hidden="true">
      <path d="M118 337c70-18 115-70 138-159 24 89 69 141 138 159" stroke="#f8f1df" strokeWidth={34} strokeLinecap="round" />
      <circle cx="256" cy="151" r="28" fill="#e5ad45" />
      <path d="M150 368h212" stroke="#f8f1df" strokeWidth={28} strokeLinecap="round" />
    </svg>
  )
}
