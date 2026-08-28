import app, { type WorkerBindings } from "./index"

export type PagesBindings = {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  WEB_ORIGIN?: string
  SILICONFLOW_API_KEY?: string
  SILICONFLOW_BASE_URL?: string
  SILICONFLOW_CHAT_MODEL?: string
  SILICONFLOW_EMBEDDING_MODEL?: string
  SILICONFLOW_TIMEOUT_MS?: string
}

export function resolvePagesBindings(request: Request, bindings: PagesBindings): WorkerBindings {
  const resolved: WorkerBindings = {
    SUPABASE_URL: bindings.SUPABASE_URL ?? bindings.VITE_SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: bindings.SUPABASE_SERVICE_ROLE_KEY ?? "",
    SUPABASE_PUBLISHABLE_KEY: bindings.SUPABASE_PUBLISHABLE_KEY ?? bindings.VITE_SUPABASE_PUBLISHABLE_KEY,
    WEB_ORIGIN: bindings.WEB_ORIGIN ?? new URL(request.url).origin,
  }
  if (bindings.SILICONFLOW_API_KEY) resolved.SILICONFLOW_API_KEY = bindings.SILICONFLOW_API_KEY
  if (bindings.SILICONFLOW_BASE_URL) resolved.SILICONFLOW_BASE_URL = bindings.SILICONFLOW_BASE_URL
  if (bindings.SILICONFLOW_CHAT_MODEL) resolved.SILICONFLOW_CHAT_MODEL = bindings.SILICONFLOW_CHAT_MODEL
  if (bindings.SILICONFLOW_EMBEDDING_MODEL) resolved.SILICONFLOW_EMBEDDING_MODEL = bindings.SILICONFLOW_EMBEDDING_MODEL
  if (bindings.SILICONFLOW_TIMEOUT_MS) resolved.SILICONFLOW_TIMEOUT_MS = bindings.SILICONFLOW_TIMEOUT_MS
  return resolved
}

export function handlePagesRequest(request: Request, bindings: PagesBindings) {
  return app.fetch(request, resolvePagesBindings(request, bindings))
}
