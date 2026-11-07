import { createResult, createResultError, type Result } from "#result"
import { imageBackground } from "./imageBackground.js"
import { imageModel } from "./imageModel.js"
import { imageOutputFormat } from "./imageOutputFormat.js"
import { imageQuality } from "./imageQuality.js"

export type ImageGptImage2Fields = {
  quality: string
  outputFormat: string
  background: string
  complexity?: string
  frameCount?: number
  frameDurationMs?: number
  safetyIdentifier?: string
}

// Rejects options codex-lb cannot serve for gpt-image-2 before any fetch.
// Evidence (codex-lb v1.25.0-beta.9, app/core/openai/images.py,
// app/modules/proxy/images_service.py, both request models extra="ignore"):
// - quality xhigh|max: 400 param "quality" (_GPT_IMAGE_2_QUALITY low|medium|high|auto).
// - outputFormat gif|svg: 400 param "output_format" (_OUTPUT_FORMATS png|jpeg|webp).
// - background transparent: 400 param "background" (rejected for gpt-image-2).
// - complexity, frameCount/frameDurationMs, safetyIdentifier: not fields on
//   either pydantic request model, so silently dropped and never forwarded.
export function imageGptImage2Validate(model: string, fields: ImageGptImage2Fields): Result<void> {
  const op = "imageGptImage2Validate"
  if (model !== imageModel.gptImage2) return createResult(undefined)
  if (fields.quality === imageQuality.xhigh || fields.quality === imageQuality.max) {
    return createResultError(
      op,
      `quality '${fields.quality}' is not supported by model 'gpt-image-2' (expected one of: low, medium, high, auto)`,
    )
  }
  if (fields.outputFormat === imageOutputFormat.gif || fields.outputFormat === imageOutputFormat.svg) {
    return createResultError(
      op,
      `outputFormat '${fields.outputFormat}' is not supported by model 'gpt-image-2' (expected one of: png, jpeg, webp)`,
    )
  }
  if (fields.background === imageBackground.transparent) {
    return createResultError(op, "background 'transparent' is not supported by model 'gpt-image-2'")
  }
  if (fields.complexity !== undefined) {
    return createResultError(op, "complexity is not supported by model 'gpt-image-2' and would be silently ignored")
  }
  if (fields.frameCount !== undefined || fields.frameDurationMs !== undefined) {
    return createResultError(
      op,
      "frameCount and frameDurationMs are not supported by model 'gpt-image-2' and would be silently ignored",
    )
  }
  if (fields.safetyIdentifier !== undefined) {
    return createResultError(
      op,
      "safetyIdentifier is not supported by model 'gpt-image-2' and would be silently ignored",
    )
  }
  return createResult(undefined)
}
