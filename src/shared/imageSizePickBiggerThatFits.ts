import { createResult, createResultError, type Result } from "#result"
import { imageModel } from "./imageModel.js"
import { imageSizeConstraints, imageSizeValidate } from "./imageRequestValidate.js"

function imageSizeRoundToMultiple(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple
}

export type ImageSizePickBiggerThatFitsOptions = {
  aspect: number
  model?: string
  maxEdgePx?: number
}

export type ImageSizePicked = {
  width: number
  height: number
  size: `${number}x${number}`
  aspect: number
  pixels: number
}

export function imageSizePickBiggerThatFits(options: ImageSizePickBiggerThatFitsOptions): Result<ImageSizePicked> {
  const op = "imageSizePickBiggerThatFits"
  const model = options.model ?? imageModel.gptImage2
  const maxEdgePx = options.maxEdgePx ?? imageSizeConstraints.gptImage2MaxEdge
  const { gptImage2DimMultiple } = imageSizeConstraints

  if (!(options.aspect > 0)) return createResultError(op, `aspect must be > 0, got ${options.aspect}`)
  if (model !== imageModel.gptImage2) {
    return createResultError(op, `flexible size selection is only supported for ${imageModel.gptImage2}`)
  }

  const aspectLong = options.aspect >= 1 ? options.aspect : 1 / options.aspect
  for (
    let longEdge = imageSizeRoundToMultiple(maxEdgePx, gptImage2DimMultiple);
    longEdge >= gptImage2DimMultiple;
    longEdge -= gptImage2DimMultiple
  ) {
    const shortEdge = imageSizeRoundToMultiple(longEdge / aspectLong, gptImage2DimMultiple)
    if (shortEdge < gptImage2DimMultiple) continue

    const width = options.aspect >= 1 ? longEdge : shortEdge
    const height = options.aspect >= 1 ? shortEdge : longEdge
    const size = `${width}x${height}` as const
    const valid = imageSizeValidate(model, size)
    if (valid.success)
      return createResult({
        width,
        height,
        size,
        aspect: width / height,
        pixels: width * height,
      })
  }

  return createResultError(op, `no valid ${model} size for aspect ${options.aspect.toFixed(4)}`)
}
