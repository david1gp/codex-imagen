import * as a from "valibot"
import { createResult, createResultError, type Result } from "#result"
import type { CliCommonFlags } from "./cliCommonFlags.js"

const cliCommonOptionsSchema = a.object({
  dotenvPath: a.optional(a.pipe(a.string(), a.minLength(1, "dotenvPath must not be empty"))),
  requestTimeoutMs: a.optional(a.pipe(a.number(), a.integer(), a.minValue(1, "requestTimeoutMs must be at least 1"))),
})

type CliCommonOptions = a.InferOutput<typeof cliCommonOptionsSchema>

export function cliCommonOptionsParse(flags: CliCommonFlags): Result<CliCommonOptions> {
  const op = "cliCommonOptionsParse"
  const parsed = a.safeParse(cliCommonOptionsSchema, flags)
  if (!parsed.success) return createResultError(op, a.summarize(parsed.issues), JSON.stringify(flags))
  return createResult(parsed.output)
}
