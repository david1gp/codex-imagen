#!/usr/bin/env bun

import { buildApplication, buildCommand, buildRouteMap, type CommandContext, help, run } from "@stricli/core"
import { type CliCommonFlags, cliCommonFlags } from "./cli/cliCommonFlags.js"
import { cliImageClientFromFlags } from "./cli/cliImageClientFromFlags.js"
import { cliImageResultPresent } from "./cli/cliImageResultPresent.js"
import { cliResultError } from "./cli/cliResultError.js"
import { cliVersionPresent } from "./cli/cliVersionPresent.js"
import type { CodexImageEditOptions } from "./edit/codexImageEdit.js"
import { codexImageEdit } from "./edit/codexImageEdit.js"
import type { CodexImageGenerateOptions } from "./generate_single/codexImageGenerate.js"
import { codexImageGenerate } from "./generate_single/codexImageGenerate.js"
import { imageBackground } from "./shared/imageBackground.js"
import { imageInputFidelity } from "./shared/imageInputFidelity.js"
import { imageModel } from "./shared/imageModel.js"
import { imageModeration } from "./shared/imageModeration.js"
import { imageOutputFormat } from "./shared/imageOutputFormat.js"
import { imageQuality } from "./shared/imageQuality.js"

type CliGenerateFlags = CliCommonFlags & Omit<CodexImageGenerateOptions, "client">
type CliEditFlags = CliCommonFlags & Omit<CodexImageEditOptions, "client">
type CliVersionFlags = { verbose?: boolean }

const cliGenerateFlags = {
  ...cliCommonFlags,
  prompt: {
    kind: "parsed" as const,
    parse: String,
    brief: "Text prompt for the image",
  },
  outputPath: {
    kind: "parsed" as const,
    parse: String,
    brief: "Path to write the generated image",
  },
  model: {
    kind: "enum" as const,
    values: Object.values(imageModel),
    optional: true as const,
    brief: "Image model",
  },
  size: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Image size: auto or WxH",
  },
  quality: {
    kind: "enum" as const,
    values: Object.values(imageQuality),
    optional: true as const,
    brief: "Image quality",
  },
  background: {
    kind: "enum" as const,
    values: Object.values(imageBackground),
    optional: true as const,
    brief: "Image background",
  },
  outputFormat: {
    kind: "enum" as const,
    values: Object.values(imageOutputFormat),
    optional: true as const,
    brief: "Output image format",
  },
  outputCompression: {
    kind: "parsed" as const,
    parse: Number,
    optional: true as const,
    brief: "Output compression from 0 to 100",
  },
  moderation: {
    kind: "enum" as const,
    values: Object.values(imageModeration),
    optional: true as const,
    brief: "Moderation level",
  },
  user: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "End-user identifier",
  },
  writeTxt: {
    kind: "boolean" as const,
    optional: true as const,
    brief: "Write the prompt to a .txt file",
  },
}

const generateCommand = buildCommand({
  async func(this: CommandContext, flags: CliGenerateFlags) {
    const clientResult = cliImageClientFromFlags(flags)
    if (!clientResult.success) return cliResultError(clientResult)

    const { dotenvPath: _dotenvPath, requestTimeoutMs: _requestTimeoutMs, ...generationFlags } = flags
    const result = await codexImageGenerate({ client: clientResult.data, ...generationFlags })
    return cliImageResultPresent(result, this.process)
  },
  parameters: { flags: cliGenerateFlags },
  docs: { brief: "Generate an image." },
})

const cliEditFlags = {
  ...cliCommonFlags,
  inputImagePath: {
    kind: "parsed" as const,
    parse: String,
    brief: "Path to the input image",
  },
  prompt: {
    kind: "parsed" as const,
    parse: String,
    brief: "Text prompt for the edit",
  },
  outputPath: {
    kind: "parsed" as const,
    parse: String,
    brief: "Path to write the edited image",
  },
  maskPath: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Optional path to a mask image",
  },
  model: {
    kind: "enum" as const,
    values: Object.values(imageModel),
    optional: true as const,
    brief: "Image model",
  },
  size: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Image size: auto or WxH",
  },
  quality: {
    kind: "enum" as const,
    values: Object.values(imageQuality),
    optional: true as const,
    brief: "Image quality",
  },
  background: {
    kind: "enum" as const,
    values: Object.values(imageBackground),
    optional: true as const,
    brief: "Image background",
  },
  outputFormat: {
    kind: "enum" as const,
    values: Object.values(imageOutputFormat),
    optional: true as const,
    brief: "Output image format",
  },
  outputCompression: {
    kind: "parsed" as const,
    parse: Number,
    optional: true as const,
    brief: "Output compression from 0 to 100",
  },
  moderation: {
    kind: "enum" as const,
    values: Object.values(imageModeration),
    optional: true as const,
    brief: "Moderation level",
  },
  inputFidelity: {
    kind: "enum" as const,
    values: Object.values(imageInputFidelity),
    optional: true as const,
    brief: "Input fidelity",
  },
  user: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "End-user identifier",
  },
  writeTxt: {
    kind: "boolean" as const,
    optional: true as const,
    brief: "Write the prompt to a .txt file",
  },
}

const editCommand = buildCommand({
  async func(this: CommandContext, flags: CliEditFlags) {
    const clientResult = cliImageClientFromFlags(flags)
    if (!clientResult.success) return cliResultError(clientResult)

    const { dotenvPath: _dotenvPath, requestTimeoutMs: _requestTimeoutMs, ...editFlags } = flags
    const result = await codexImageEdit({ client: clientResult.data, ...editFlags })
    return cliImageResultPresent(result, this.process)
  },
  parameters: { flags: cliEditFlags },
  docs: { brief: "Edit an image." },
})

const versionCommand = buildCommand({
  func(this: CommandContext, flags: CliVersionFlags) {
    cliVersionPresent(flags.verbose === true, this.process)
  },
  parameters: {
    flags: {
      verbose: {
        kind: "boolean" as const,
        optional: true as const,
        brief: "Include package and runtime metadata",
      },
    },
  },
  docs: { brief: "Print the CLI version." },
})

const root = buildRouteMap({
  routes: { generate: generateCommand, edit: editCommand, version: versionCommand },
  docs: { brief: "Generate and edit images." },
})

const app = buildApplication(
  root,
  {
    name: "codex-imagen",
    scanner: { caseStyle: "allow-kebab-for-camel" },
  },
  {
    help: help({
      brief: "Print help information and exit",
      formatting: {
        useAliasInUsageLine: false,
        onlyRequiredInUsageLine: false,
        caseStyle: "original",
      },
    }),
  },
)

await run(app, process.argv.slice(2), { process })
