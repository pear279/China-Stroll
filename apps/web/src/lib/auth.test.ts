import { describe, expect, it, vi } from "vitest"
import { maskEmail, startEmailLogin, type LoginAuthClient } from "./auth"

function createAuthClient() {
  return {
    signInAnonymously: vi.fn(async () => ({ data: { session: null }, error: null })),
    signInWithOtp: vi.fn(async () => ({ data: { session: null }, error: null })),
  } satisfies LoginAuthClient
}

describe("email login", () => {
  it("uses an anonymous session in test mode without sending the email", async () => {
    const auth = createAuthClient()

    await startEmailLogin(auth, "visitor@example.com", "https://china-stroll.pages.dev", true)

    expect(auth.signInAnonymously).toHaveBeenCalledOnce()
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it("keeps magic-link login when test mode is disabled", async () => {
    const auth = createAuthClient()

    await startEmailLogin(auth, " visitor@example.com ", "https://china-stroll.pages.dev", false)

    expect(auth.signInAnonymously).not.toHaveBeenCalled()
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "visitor@example.com",
      options: { emailRedirectTo: "https://china-stroll.pages.dev" },
    })
  })

  it("stores only a masked local label", () => {
    expect(maskEmail("Visitor@example.com")).toBe("v***@example.com")
    expect(maskEmail("x@example.com")).toBe("x@example.com")
  })
})
