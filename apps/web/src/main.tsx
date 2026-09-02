import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "maplibre-gl/dist/maplibre-gl.css"
import "./styles.css"
import { App } from "./App"
import { LocaleProvider } from "./lib/i18n"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LocaleProvider>
  </StrictMode>,
)
