import { resolve } from "node:path"
import { config, type DotenvPopulateInput } from "dotenv"
import { createResult, createResultError, type Result } from "#result"

export function cliDotenvLoad(
  dotenvPath: string | undefined,
  environment: DotenvPopulateInput = process.env,
): Result<void> {
  const op = "cliDotenvLoad"
  const path = dotenvPath ?? resolve(process.cwd(), ".env")
  const loaded = config({ path, processEnv: environment, quiet: true })
  if (!loaded.error) return createResult(undefined)

  const errorCode = (loaded.error as NodeJS.ErrnoException).code
  if (dotenvPath === undefined && errorCode === "ENOENT") return createResult(undefined)
  return createResultError(op, `Unable to load dotenv file '${path}': ${loaded.error.message}`)
}
