import { readFileSync } from "node:fs"
import * as a from "valibot"
import { createResult, createResultError, type Result } from "#result"
import { type CliConfig, cliConfigSchema } from "./cliConfigSchema.js"

export function cliConfigLoad(configPath: string, explicit: boolean): Result<CliConfig | undefined> {
  const op = "cliConfigLoad"
  let raw: string
  try {
    raw = readFileSync(configPath, "utf8")
  } catch (error) {
    if (!explicit && (error as NodeJS.ErrnoException).code === "ENOENT") return createResult(undefined)
    return createResultError(op, `Unable to load config file '${configPath}': ${(error as Error).message}`)
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    return createResultError(op, `Unable to parse config file '${configPath}': ${(error as Error).message}`)
  }

  const parsed = a.safeParse(cliConfigSchema, parsedJson)
  if (!parsed.success) {
    return createResultError(op, `Invalid config file '${configPath}': ${a.summarize(parsed.issues)}`)
  }
  return createResult(parsed.output)
}
