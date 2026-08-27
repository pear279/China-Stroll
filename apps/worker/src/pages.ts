import app, { type WorkerBindings } from "./index"

export type PagesBindings = {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  WEB_ORIGIN?: string
}

export function resolvePagesBindings(request: Request, bindings: PagesBindings): WorkerBindings {
  return {
    SUPABASE_URL: bindings.SUPABASE_URL ?? bindings.VITE_SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: bindings.SUPABASE_SERVICE_ROLE_KEY ?? "",
    WEB_ORIGIN: bindings.WEB_ORIGIN ?? new URL(request.url).origin,
  }
}

export function handlePagesRequest(request: Request, bindings: PagesBindings) {
  return app.fetch(request, resolvePagesBindings(request, bindings))
}
