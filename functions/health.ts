import { handlePagesRequest, type PagesBindings } from "../apps/worker/src/pages"

export const onRequest: PagesFunction<PagesBindings> = ({ request, env }) => handlePagesRequest(request, env)
