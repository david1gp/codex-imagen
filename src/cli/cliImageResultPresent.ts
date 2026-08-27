import type { CommandContext } from "@stricli/core"
import type { Result } from "#result"
import type { CodexImageResult } from "../shared/codexImageResultWrite.js"
import { cliResultError } from "./cliResultError.js"

export function cliImageResultPresent(
  result: Result<CodexImageResult>,
  output: CommandContext["process"],
): Error | undefined {
  if (!result.success) return cliResultError(result)
  output.stdout.write(`${result.data.outputPath}\n`)
  return undefined
}
