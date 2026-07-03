import { createResult, createResultError, type Result } from "#result"
import type { ImageBackground } from "./imageBackground.js"
import type { ImageInputFidelity } from "./imageInputFidelity.js"
import { imageModel } from "./imageModel.js"

export const imageSizeConstraints = {
  gptImage2DimMultiple: 16,
  gptImage2MaxEdge: 3840,
  gptImage2MinPixels: 655_360,
  gptImage2MaxPixels: 8_294_400,
  gptImage2RatioMax: 3,
} as const

const LEGACY_FIXED_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536", "auto"])
const INPUT_FIDELITY_MODELS = new Set<string>([imageModel.gptImage15, imageModel.gptImage1])
const SIZE_PATTERN = /^(\d+)x(\d+)$/

export type ImageRequestValidateInput = {
  model: string
  size: string
  background: ImageBackground
  inputFidelity: ImageInputFidelity | undefined
  isEdit: boolean
}

export function imageRequestValidate(input: ImageRequestValidateInput): Result<void> {
  const op = "imageRequestValidate"
  const { model, size, background, inputFidelity, isEdit } = input

  if (model === imageModel.gptImage2) {
    if (background === "transparent") {
      return createResultError(op, "background='transparent' is not supported by gpt-image-2")
    }
    if (inputFidelity !== undefined) return createResultError(op, "input_fidelity is not supported by gpt-image-2")
  } else if (inputFidelity !== undefined) {
    if (!isEdit) return createResultError(op, "input_fidelity is only supported on image edits")
    if (!INPUT_FIDELITY_MODELS.has(model)) return createResultError(op, `input_fidelity is not supported by ${model}`)
  }

  return imageSizeValidate(model, size)
}

export function imageSizeValidate(model: string, size: string): Result<void> {
  const op = "imageSizeValidate"
  if (size === "auto") return createResult(undefined)
  const match = SIZE_PATTERN.exec(size)
  if (!match) return createResultError(op, `Invalid size '${size}'. Expected 'auto' or WxH.`)

  const width = Number(match[1])
  const height = Number(match[2])
  if (model === imageModel.gptImage2) return imageSizeValidateGptImage2(width, height)
  if (!LEGACY_FIXED_SIZES.has(size)) {
    return createResultError(
      op,
      `Invalid size '${size}' for model '${model}'. Allowed: 1024x1024, 1536x1024, 1024x1536, auto.`,
    )
  }
  return createResult(undefined)
}

export function imageSizeValidateGptImage2(width: number, height: number): Result<void> {
  const op = "imageSizeValidateGptImage2"
  const { gptImage2DimMultiple, gptImage2MaxEdge, gptImage2MinPixels, gptImage2MaxPixels, gptImage2RatioMax } =
    imageSizeConstraints

  if (width <= 0 || height <= 0) return createResultError(op, "size dimensions must be positive integers")
  if (width % gptImage2DimMultiple !== 0 || height % gptImage2DimMultiple !== 0) {
    return createResultError(op, `size dimensions must be multiples of ${gptImage2DimMultiple} for gpt-image-2`)
  }
  if (Math.max(width, height) > gptImage2MaxEdge) {
    return createResultError(op, `size edges must be <= ${gptImage2MaxEdge} px for gpt-image-2`)
  }
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > gptImage2RatioMax) {
    return createResultError(op, `size aspect ratio must be at most ${gptImage2RatioMax}:1 for gpt-image-2`)
  }
  const pixels = width * height
  if (pixels < gptImage2MinPixels || pixels > gptImage2MaxPixels) {
    return createResultError(
      op,
      `size total pixels must be between ${gptImage2MinPixels} and ${gptImage2MaxPixels} for gpt-image-2`,
    )
  }
  return createResult(undefined)
}
