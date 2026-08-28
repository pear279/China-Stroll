import { describe, expect, it, vi } from "vitest"
import { generateEmbeddings, generateTripSuggestion, siliconFlowConfigFromBindings } from "./siliconflow"

const config = siliconFlowConfigFromBindings({ SILICONFLOW_API_KEY: "test-key" })

describe("SiliconFlow configuration", () => {
  it("uses the approved model identifiers and safe defaults", () => {
    expect(config).toMatchObject({
      baseUrl: "https://api.siliconflow.cn/v1",
      chatModel: "deepseek-ai/DeepSeek-V4-Flash",
      embeddingModel: "BAAI/bge-m3",
      timeoutMs: 15000,
    })
  })

  it("does not call the provider before an API key is configured", async () => {
    const fetcher = vi.fn()
    await expect(generateTripSuggestion(siliconFlowConfigFromBindings({}), { intent: "Make a plan", locale: "en", stops: [] }, fetcher)).resolves.toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("validates structured model suggestions", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        reason: "Visit the northern pair first.",
        changes: [{ op: "update_stop", stopId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", startTime: "09:00", durationMinutes: 120, sortOrder: 0 }],
        risks: ["Check opening hours on the day."],
      }) } }] }), { status: 200 }),
    )
    await expect(generateTripSuggestion(config, { intent: "Make a plan", locale: "en", stops: [] }, fetcher)).resolves.toMatchObject({
      changes: [{ op: "update_stop", startTime: "09:00" }],
    })
    expect(fetcher).toHaveBeenCalledWith("https://api.siliconflow.cn/v1/chat/completions", expect.objectContaining({ method: "POST" }))
  })

  it("accepts only 1024-dimension bge-m3 embeddings", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ embedding: Array(1024).fill(0.1) }] }), { status: 200 }))
    await expect(generateEmbeddings(config, ["故宫"], fetcher)).resolves.toHaveLength(1)
  })
})
