import * as a from "valibot"

export const codexImagenRequestTimeoutDefaultMs = 300_000

export type CodexImagenFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export const codexImagenClientSchema = a.object({
  baseUrl: a.pipe(a.string(), a.minLength(1, "baseUrl is required")),
  apiKey: a.pipe(a.string(), a.minLength(1, "apiKey is required")),
  requestTimeoutMs: a.optional(a.pipe(a.number(), a.integer(), a.minValue(1)), codexImagenRequestTimeoutDefaultMs),
  fetch: a.optional(a.custom<CodexImagenFetch>((value) => typeof value === "function", "fetch must be a function")),
})

export type CodexImagenClient = a.InferOutput<typeof codexImagenClientSchema>
export type CodexImagenClientInput = a.InferInput<typeof codexImagenClientSchema>

export function codexImagenBaseUrlNormalize(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}
