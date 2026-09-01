import { z } from "zod"
import type { TranslationRequest } from "../../../packages/shared/src"
import type { SiliconFlowConfig } from "./siliconflow"

const exchangeQuoteSchema = z.object({
  base: z.string().length(3),
  quote: z.string().length(3),
  rate: z.number().positive(),
  provider: z.string().trim().min(1).max(80),
  retrievedAt: z.iso.datetime({ offset: true }),
})

export type ExchangeQuoteInput = z.infer<typeof exchangeQuoteSchema>

// Provider-neutral exchange adapter. Without a configured provider URL it returns
// null so the UI can report an honest "live rates unavailable" state rather than
// inventing a rate.
export async function fetchExchangeQuote(
  providerUrl: string | undefined,
  base: string,
  quote: string,
  fetcher: typeof fetch = fetch,
): Promise<ExchangeQuoteInput | null> {
  if (!providerUrl) return null
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetcher(
      `${providerUrl}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`,
      { signal: controller.signal },
    )
    if (!response.ok) return null
    const payload = await response.json() as { rates?: Record<string, number>; provider?: string }
    const rate = payload.rates?.[quote]
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null
    return exchangeQuoteSchema.parse({
      base,
      quote,
      rate,
      provider: payload.provider ?? "exchange-provider",
      retrievedAt: new Date().toISOString(),
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

const translationResultSchema = z.object({ translatedText: z.string().trim().min(1).max(4000) })

export async function translateText(
  config: SiliconFlowConfig,
  input: TranslationRequest,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!config.apiKey) return null
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetcher(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.chatModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Translate the user text from ${input.from} to ${input.to}. Return one JSON object with only the key translatedText. Preserve meaning and tone; do not invent content.`,
          },
          { role: "user", content: input.text },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`siliconflow_status_${response.status}`)
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error("siliconflow_empty_response")
    return translationResultSchema.parse(JSON.parse(content)).translatedText
  } finally {
    clearTimeout(timeoutId)
  }
}
