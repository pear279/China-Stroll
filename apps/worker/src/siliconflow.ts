import { z } from "zod"
import { agentChangesSchema, suggestionRisksSchema } from "./contracts"

const modelSuggestionSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  changes: agentChangesSchema.min(1).max(10),
  risks: suggestionRisksSchema.max(5),
})

const placeAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(3000),
  sourceIds: z.array(z.int().positive()).max(8),
})

export type SiliconFlowConfig = {
  apiKey?: string
  baseUrl: string
  chatModel: string
  embeddingModel: string
  timeoutMs: number
}

export type TripSuggestionInput = {
  intent: string
  locale: "en" | "zh-CN"
  stops: Array<{
    id: string
    placeId: string | null
    name: string
    dayNumber: number | null
    startTime: string | null
    durationMinutes: number | null
    sortOrder: number
  }>
}

export type ModelSuggestion = z.infer<typeof modelSuggestionSchema>
export type ModelPlaceAnswer = z.infer<typeof placeAnswerSchema>

type Fetcher = typeof fetch

export function siliconFlowConfigFromBindings(bindings: {
  SILICONFLOW_API_KEY?: string
  SILICONFLOW_BASE_URL?: string
  SILICONFLOW_CHAT_MODEL?: string
  SILICONFLOW_EMBEDDING_MODEL?: string
  SILICONFLOW_TIMEOUT_MS?: string
}): SiliconFlowConfig {
  const timeout = Number(bindings.SILICONFLOW_TIMEOUT_MS ?? "15000")
  return {
    apiKey: bindings.SILICONFLOW_API_KEY,
    baseUrl: (bindings.SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn/v1").replace(/\/$/, ""),
    chatModel: bindings.SILICONFLOW_CHAT_MODEL ?? "deepseek-ai/DeepSeek-V4-Flash",
    embeddingModel: bindings.SILICONFLOW_EMBEDDING_MODEL ?? "BAAI/bge-m3",
    timeoutMs: Number.isFinite(timeout) && timeout >= 1000 && timeout <= 30000 ? timeout : 15000,
  }
}

export async function generateTripSuggestion(
  config: SiliconFlowConfig,
  input: TripSuggestionInput,
  fetcher: Fetcher = fetch,
): Promise<ModelSuggestion | null> {
  if (!config.apiKey) return null

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetcher(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.chatModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You propose a travel-plan draft only. Return one JSON object with reason, changes, and risks. Use update_stop operations only. Each stopId must be copied exactly from the supplied stops. Do not invent places, times, or opening-hours facts. Keep risks explicit. The user must confirm every proposal before it can be applied.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`siliconflow_status_${response.status}`)
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error("siliconflow_empty_response")
    return modelSuggestionSchema.parse(JSON.parse(content))
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function generatePlaceAnswer(
  config: SiliconFlowConfig,
  input: {
    question: string
    locale: "en" | "zh-CN"
    placeName: string
    passages: Array<{ id: number; sourceIds: number[]; title: string | null; content: string }>
  },
  fetcher: Fetcher = fetch,
): Promise<ModelPlaceAnswer | null> {
  if (!config.apiKey || input.passages.length === 0) return null

  const allowedSourceIds = new Set(input.passages.flatMap((passage) => passage.sourceIds))
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetcher(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.chatModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Answer only from the supplied reviewed passages. Return one JSON object with answer and sourceIds. If the passages do not support the answer, say that the available guide cannot confirm it. Never invent opening hours, prices, booking rules, safety facts, or history. Keep the answer under 180 words.",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`siliconflow_status_${response.status}`)
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error("siliconflow_empty_response")
    const parsed = placeAnswerSchema.parse(JSON.parse(content))
    if (!parsed.sourceIds.every((sourceId) => allowedSourceIds.has(sourceId))) {
      throw new Error("siliconflow_unknown_source")
    }
    return parsed
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function generateEmbeddings(
  config: SiliconFlowConfig,
  input: string[],
  fetcher: Fetcher = fetch,
): Promise<number[][]> {
  if (!config.apiKey) throw new Error("siliconflow_api_key_missing")
  const response = await fetcher(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: config.embeddingModel, input, encoding_format: "float" }),
  })
  if (!response.ok) throw new Error(`siliconflow_status_${response.status}`)
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> }
  const embeddings = payload.data?.map((item) => item.embedding)
  if (!embeddings || !embeddings.every((embedding): embedding is number[] => Array.isArray(embedding) && embedding.length === 1024)) {
    throw new Error("siliconflow_embedding_dimension_invalid")
  }
  return embeddings
}
