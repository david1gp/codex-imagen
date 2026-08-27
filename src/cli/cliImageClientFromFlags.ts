import type { DotenvPopulateInput } from "dotenv"
import type { Result } from "#result"
import type { CodexImagenClient } from "../shared/codexImagenClient.js"
import type { CliCommonFlags } from "./cliCommonFlags.js"
import { cliCommonOptionsParse } from "./cliCommonOptionsParse.js"
import { cliDotenvLoad } from "./cliDotenvLoad.js"
import { cliImageClientCreate } from "./cliImageClientCreate.js"

export function cliImageClientFromFlags(
  flags: CliCommonFlags,
  environment: DotenvPopulateInput = process.env,
): Result<CodexImagenClient> {
  const optionsResult = cliCommonOptionsParse(flags)
  if (!optionsResult.success) return optionsResult

  const dotenvResult = cliDotenvLoad(optionsResult.data.dotenvPath, environment)
  if (!dotenvResult.success) return dotenvResult

  return cliImageClientCreate(environment, optionsResult.data.requestTimeoutMs)
}
