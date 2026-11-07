import * as a from "valibot"
import { createResultError, type Result, resultTryParsingFetchErr } from "#result"
import { codexImagenBaseUrlNormalize, codexImagenClientSchema } from "../shared/codexImagenClient.js"
import type { CodexImageResult } from "../shared/codexImageResultWrite.js"
import { codexImageResultWrite } from "../shared/codexImageResultWrite.js"
import { imageBackgroundDefault, imageBackgroundSchema } from "../shared/imageBackground.js"
import { imageComplexitySchema } from "../shared/imageComplexity.js"
import { imageFrameCountSchema } from "../shared/imageFrameCount.js"
import { imageFrameDurationMsSchema } from "../shared/imageFrameDurationMs.js"
import { imageGptImage2Validate } from "../shared/imageGptImage2Validate.js"
import { imageModelDefault, imageModelSchema } from "../shared/imageModel.js"
import { imageModerationDefault, imageModerationSchema } from "../shared/imageModeration.js"
import { imageOutputCompressionDefault, imageOutputCompressionSchema } from "../shared/imageOutputCompression.js"
import { imageOutputFormatDefault, imageOutputFormatSchema } from "../shared/imageOutputFormat.js"
import { imageQualityDefault, imageQualitySchema } from "../shared/imageQuality.js"
import { imageSizeValidate } from "../shared/imageRequestValidate.js"
import { imageSizeCommon, imageSizeSchema } from "../shared/imageSize.js"

export const codexImageGenerateOptionsSchema = a.object({
  client: codexImagenClientSchema,
  prompt: a.pipe(a.string(), a.minLength(1, "prompt is required")),
  outputPath: a.pipe(a.string(), a.minLength(1, "outputPath is required")),
  model: a.optional(imageModelSchema, imageModelDefault),
  size: a.optional(imageSizeSchema, imageSizeCommon.widescreen),
  quality: a.optional(imageQualitySchema, imageQualityDefault),
  background: a.optional(imageBackgroundSchema, imageBackgroundDefault),
  outputFormat: a.optional(imageOutputFormatSchema, imageOutputFormatDefault),
  outputCompression: a.optional(imageOutputCompressionSchema, imageOutputCompressionDefault),
  moderation: a.optional(imageModerationSchema, imageModerationDefault),
  complexity: a.optional(imageComplexitySchema),
  frameCount: a.optional(imageFrameCountSchema),
  frameDurationMs: a.optional(imageFrameDurationMsSchema),
  user: a.optional(a.string()),
  safetyIdentifier: a.optional(a.pipe(a.string(), a.minLength(1), a.maxLength(128))),
  writeTxt: a.optional(a.boolean(), true),
})

export type CodexImageGenerateOptions = a.InferInput<typeof codexImageGenerateOptionsSchema>

export async function codexImageGenerate(options: CodexImageGenerateOptions): Promise<Result<CodexImageResult>> {
  const op = "codexImageGenerate"

  const optionsResult = a.safeParse(codexImageGenerateOptionsSchema, options)
  if (!optionsResult.success) return createResultError(op, a.summarize(optionsResult.issues), JSON.stringify(options))

  const {
    client,
    prompt,
    outputPath,
    model,
    size,
    quality,
    background,
    outputFormat,
    outputCompression,
    moderation,
    complexity,
    frameCount,
    frameDurationMs,
    user,
    safetyIdentifier,
    writeTxt,
  } = optionsResult.output

  const gptImage2Result = imageGptImage2Validate(model, {
    quality,
    outputFormat,
    background,
    complexity,
    frameCount,
    frameDurationMs,
    safetyIdentifier,
  })
  if (!gptImage2Result.success) return gptImage2Result

  const validateResult = imageSizeValidate(size)
  if (!validateResult.success) return validateResult

  if ((frameCount !== undefined || frameDurationMs !== undefined) && outputFormat !== "gif") {
    return createResultError(op, "frameCount and frameDurationMs require outputFormat 'gif'")
  }

  const url = `${codexImagenBaseUrlNormalize(client.baseUrl)}/images/generations`
  const fetchImpl = client.fetch ?? fetch

  let raw: string
  let ok: boolean
  let status: number
  let statusText: string
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        quality,
        background,
        output_format: outputFormat,
        ...(outputFormat === "gif" || outputFormat === "svg" ? {} : { output_compression: outputCompression }),
        moderation,
        ...(complexity !== undefined ? { complexity } : {}),
        ...(frameCount !== undefined ? { frame_count: frameCount } : {}),
        ...(frameDurationMs !== undefined ? { frame_duration_ms: frameDurationMs } : {}),
        ...(user !== undefined ? { user } : {}),
        ...(safetyIdentifier !== undefined ? { safety_identifier: safetyIdentifier } : {}),
      }),
      signal: AbortSignal.timeout(client.requestTimeoutMs),
    })
    raw = await response.text()
    ok = response.ok
    status = response.status
    statusText = response.statusText
  } catch (error) {
    return createResultError(op, error instanceof Error ? error.message : String(error))
  }

  if (!ok) return resultTryParsingFetchErr(op, raw, status, statusText)
  return codexImageResultWrite(raw, prompt, outputPath, writeTxt)
}
