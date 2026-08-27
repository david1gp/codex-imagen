import * as a from "valibot"
import { createResult, createResultError, type Result } from "#result"
import {
  type CodexImagenClient,
  type CodexImagenClientInput,
  codexImagenClientSchema,
} from "../shared/codexImagenClient.js"

export function cliImageClientCreate(
  environment: Readonly<Record<string, string | undefined>>,
  requestTimeoutMs?: number,
): Result<CodexImagenClient> {
  const op = "cliImageClientCreate"
  const baseUrl = environment.CODEX_IMAGE_BASE_URL
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    return createResultError(op, "CODEX_IMAGE_BASE_URL is required")
  }

  const apiKey = environment.CODEX_IMAGE_API_KEY
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return createResultError(op, "CODEX_IMAGE_API_KEY is required")
  }

  const clientInput: CodexImagenClientInput = { baseUrl, apiKey }
  if (requestTimeoutMs !== undefined) clientInput.requestTimeoutMs = requestTimeoutMs

  const parsed = a.safeParse(codexImagenClientSchema, clientInput)
  if (!parsed.success) return createResultError(op, a.summarize(parsed.issues))
  return createResult(parsed.output)
}
