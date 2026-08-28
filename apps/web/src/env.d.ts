/// <reference types="vite/client" />

declare module "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url" {
  const workerUrl: string
  export default workerUrl
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ENABLE_TEST_LOGIN?: string
}
