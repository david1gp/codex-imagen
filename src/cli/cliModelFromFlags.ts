import { createResult, type Result } from "#result"
import type { ImageModel } from "../shared/imageModel.js"
import { cliConfigLoad } from "./cliConfigLoad.js"
import { cliConfigPathResolve } from "./cliConfigPathResolve.js"

export function cliModelFromFlags(flags: { model?: ImageModel; configPath?: string }): Result<ImageModel | undefined> {
  if (flags.model !== undefined) return createResult(flags.model)

  const configPath = cliConfigPathResolve(flags.configPath)
  const configResult = cliConfigLoad(configPath, flags.configPath !== undefined)
  if (!configResult.success) return configResult
  return createResult(configResult.data?.model)
}
