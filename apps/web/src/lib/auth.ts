import type { Session } from "@supabase/supabase-js"

export const TEST_EMAIL_LABEL_KEY = "china-stroll-test-email-label"

type SignInResult = {
  data: { session: Session | null }
  error: { message: string } | null
}

export type LoginAuthClient = {
  signInAnonymously: () => Promise<SignInResult>
  signInWithOtp: (credentials: {
    email: string
    options: { emailRedirectTo: string }
  }) => Promise<SignInResult>
}

export const isTestLoginEnabled = import.meta.env.VITE_ENABLE_TEST_LOGIN !== "false"

export function maskEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  const [localPart, domain] = normalized.split("@")
  if (!localPart || !domain) return "Test visitor"
  return `${localPart[0]}${localPart.length > 1 ? "***" : ""}@${domain}`
}

export async function startEmailLogin(
  auth: LoginAuthClient,
  email: string,
  redirectTo: string,
  testMode: boolean,
) {
  if (testMode) return auth.signInAnonymously()
  return auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  })
}
