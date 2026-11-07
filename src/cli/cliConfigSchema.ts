import * as a from "valibot"

export const cliConfigSchema = a.object({
  baseUrl: a.optional(a.pipe(a.string(), a.trim(), a.minLength(1, "baseUrl must not be empty"))),
  apiKey: a.optional(a.pipe(a.string(), a.trim(), a.minLength(1, "apiKey must not be empty"))),
  apiKeyEnv: a.optional(a.pipe(a.string(), a.trim(), a.minLength(1, "apiKeyEnv must not be empty"))),
  requestTimeoutMs: a.optional(a.pipe(a.number(), a.integer(), a.minValue(1, "requestTimeoutMs must be at least 1"))),
})

export type CliConfig = a.InferOutput<typeof cliConfigSchema>
