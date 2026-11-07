import type { DotenvPopulateInput } from "dotenv"
import { createResultError, type Result } from "#result"
import type { CodexImagenClient } from "../shared/codexImagenClient.js"
import type { CliCommonFlags } from "./cliCommonFlags.js"
import { cliCommonOptionsParse } from "./cliCommonOptionsParse.js"
import { cliConfigLoad } from "./cliConfigLoad.js"
import { cliConfigPathResolve } from "./cliConfigPathResolve.js"
import { cliDotenvLoad } from "./cliDotenvLoad.js"
import { cliImageClientCreate } from "./cliImageClientCreate.js"

function environmentValue(environment: DotenvPopulateInput, name: string): string | undefined {
  const value = environment[name]
  if (typeof value !== "string" || value.trim().length === 0) return undefined
  return value
}

export function cliImageClientFromFlags(
  flags: CliCommonFlags,
  environment: DotenvPopulateInput = process.env,
): Result<CodexImagenClient> {
  const op = "cliImageClientFromFlags"
  const optionsResult = cliCommonOptionsParse(flags)
  if (!optionsResult.success) return optionsResult

  const dotenvResult = cliDotenvLoad(optionsResult.data.dotenvPath, environment)
  if (!dotenvResult.success) return dotenvResult

  const options = optionsResult.data
  const configPath = cliConfigPathResolve(options.configPath, environment)
  const configResult = cliConfigLoad(configPath, options.configPath !== undefined)
  if (!configResult.success) return configResult
  const config = configResult.data

  const resolvedEnvironment: Record<string, string | undefined> = { ...environment }

  const environmentBaseUrl = environmentValue(resolvedEnvironment, "CODEX_IMAGE_BASE_URL")
  const resolvedBaseUrl = options.baseUrl ?? environmentBaseUrl ?? config?.baseUrl
  if (resolvedBaseUrl === undefined) delete resolvedEnvironment.CODEX_IMAGE_BASE_URL
  else resolvedEnvironment.CODEX_IMAGE_BASE_URL = resolvedBaseUrl

  if (
    resolvedEnvironment.CODEX_IMAGE_API_KEY === undefined ||
    resolvedEnvironment.CODEX_IMAGE_API_KEY.trim().length === 0
  ) {
    const apiKeyEnvName = options.apiKeyEnv ?? config?.apiKeyEnv
    if (apiKeyEnvName !== undefined) {
      const viaName = environmentValue(environment, apiKeyEnvName)
      if (viaName === undefined) {
        const source = options.apiKeyEnv !== undefined ? "--api-key-env" : "config apiKeyEnv"
        return createResultError(
          op,
          `Environment variable '${apiKeyEnvName}' is required (selected via ${source}) but is unset or empty`,
        )
      }
      resolvedEnvironment.CODEX_IMAGE_API_KEY = viaName
    } else if (config?.apiKey !== undefined) {
      resolvedEnvironment.CODEX_IMAGE_API_KEY = config.apiKey
    }
  }

  return cliImageClientCreate(resolvedEnvironment, options.requestTimeoutMs ?? config?.requestTimeoutMs)
}
