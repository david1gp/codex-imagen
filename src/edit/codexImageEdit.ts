import { existsSync, readFileSync } from "node:fs"
import { basename, extname } from "node:path"
import * as a from "valibot"
import { createResultError, type Result, resultTryParsingFetchErr } from "#result"
import { codexImagenBaseUrlNormalize, codexImagenClientSchema } from "../shared/codexImagenClient.js"
import type { CodexImageResult } from "../shared/codexImageResultWrite.js"
import { codexImageResultWrite } from "../shared/codexImageResultWrite.js"
import { imageBackgroundDefault, imageBackgroundSchema } from "../shared/imageBackground.js"
import { imageComplexitySchema } from "../shared/imageComplexity.js"
import { imageGptImage2Validate } from "../shared/imageGptImage2Validate.js"
import { imageModelDefault, imageModelSchema } from "../shared/imageModel.js"
import { imageModerationDefault, imageModerationSchema } from "../shared/imageModeration.js"
import { imageOutputCompressionDefault, imageOutputCompressionSchema } from "../shared/imageOutputCompression.js"
import { imageOutputFormatDefault, imageOutputFormatSchema } from "../shared/imageOutputFormat.js"
import { imageQualityDefault, imageQualitySchema } from "../shared/imageQuality.js"
import { imageSizeValidate } from "../shared/imageRequestValidate.js"
import { imageSizeCommon, imageSizeSchema } from "../shared/imageSize.js"

const imageMimeByExtension: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
}
const imageMimeFallback = "image/png"

export function imageMimeFromPath(path: string): string {
  return imageMimeByExtension[extname(path).toLowerCase()] ?? imageMimeFallback
}

const readablePathSchema = a.pipe(
  a.string(),
  a.minLength(1),
  a.check((path) => existsSync(path), "image path not readable"),
)

export const codexImageEditOptionsSchema = a.object({
  client: codexImagenClientSchema,
  inputImagePath: readablePathSchema,
  prompt: a.pipe(a.string(), a.minLength(1, "prompt is required")),
  outputPath: a.pipe(a.string(), a.minLength(1, "outputPath is required")),
  maskPath: a.optional(readablePathSchema),
  markupPath: a.optional(readablePathSchema),
  model: a.optional(imageModelSchema, imageModelDefault),
  size: a.optional(imageSizeSchema, imageSizeCommon.landscape),
  quality: a.optional(imageQualitySchema, imageQualityDefault),
  background: a.optional(imageBackgroundSchema, imageBackgroundDefault),
  outputFormat: a.optional(imageOutputFormatSchema, imageOutputFormatDefault),
  outputCompression: a.optional(imageOutputCompressionSchema, imageOutputCompressionDefault),
  moderation: a.optional(imageModerationSchema, imageModerationDefault),
  complexity: a.optional(imageComplexitySchema),
  user: a.optional(a.string()),
  safetyIdentifier: a.optional(a.pipe(a.string(), a.minLength(1), a.maxLength(128))),
  writeTxt: a.optional(a.boolean(), true),
})

export type CodexImageEditOptions = a.InferInput<typeof codexImageEditOptionsSchema>

export async function codexImageEdit(options: CodexImageEditOptions): Promise<Result<CodexImageResult>> {
  const op = "codexImageEdit"

  const optionsResult = a.safeParse(codexImageEditOptionsSchema, options)
  if (!optionsResult.success) return createResultError(op, a.summarize(optionsResult.issues), JSON.stringify(options))

  const {
    client,
    inputImagePath,
    prompt,
    outputPath,
    maskPath,
    markupPath,
    model,
    size,
    quality,
    background,
    outputFormat,
    outputCompression,
    moderation,
    complexity,
    user,
    safetyIdentifier,
    writeTxt,
  } = optionsResult.output

  const gptImage2Result = imageGptImage2Validate(model, {
    quality,
    outputFormat,
    background,
    complexity,
    safetyIdentifier,
  })
  if (!gptImage2Result.success) return gptImage2Result

  const validateResult = imageSizeValidate(size)
  if (!validateResult.success) return validateResult

  if (maskPath !== undefined && markupPath !== undefined) {
    return createResultError(op, "maskPath and markupPath are mutually exclusive")
  }
  if (outputFormat === "gif" || outputFormat === "svg") {
    return createResultError(op, `outputFormat '${outputFormat}' is not supported for image edits`)
  }

  const form = new FormData()
  try {
    form.set("model", model)
    form.set("prompt", prompt)
    form.set("n", "1")
    form.set("size", size)
    form.set("quality", quality)
    form.set("background", background)
    form.set("output_format", outputFormat)
    form.set("output_compression", String(outputCompression))
    form.set("moderation", moderation)
    if (complexity !== undefined) form.set("complexity", complexity)
    if (user !== undefined) form.set("user", user)
    if (safetyIdentifier !== undefined) form.set("safety_identifier", safetyIdentifier)
    form.append(
      "image[]",
      new Blob([readFileSync(inputImagePath)], {
        type: imageMimeFromPath(inputImagePath),
      }),
      basename(inputImagePath),
    )
    if (maskPath !== undefined) {
      form.append(
        "mask",
        new Blob([readFileSync(maskPath)], {
          type: imageMimeFromPath(maskPath),
        }),
        basename(maskPath),
      )
    }
    if (markupPath !== undefined) {
      form.append(
        "markup",
        new Blob([readFileSync(markupPath)], {
          type: imageMimeFromPath(markupPath),
        }),
        basename(markupPath),
      )
    }
  } catch (error) {
    return createResultError(op, error instanceof Error ? error.message : String(error))
  }

  const url = `${codexImagenBaseUrlNormalize(client.baseUrl)}/images/edits`
  const fetchImpl = client.fetch ?? fetch

  let raw: string
  let ok: boolean
  let status: number
  let statusText: string
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${client.apiKey}` },
      body: form,
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
