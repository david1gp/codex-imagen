import { createResult, createResultError, type Result } from "#result"
import { imageSizeConstraints, imageSizeValidate } from "./imageRequestValidate.js"

function imageSizeRoundToMultiple(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple
}

export type ImageSizePickBiggerThatFitsOptions = {
  aspect: number
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
  const maxEdgePx = options.maxEdgePx ?? imageSizeConstraints.maxEdge
  const { dimMultiple } = imageSizeConstraints

  if (!(options.aspect > 0)) return createResultError(op, `aspect must be > 0, got ${options.aspect}`)

  const aspectLong = options.aspect >= 1 ? options.aspect : 1 / options.aspect
  for (
    let longEdge = imageSizeRoundToMultiple(maxEdgePx, dimMultiple);
    longEdge >= dimMultiple;
    longEdge -= dimMultiple
  ) {
    const shortEdge = imageSizeRoundToMultiple(longEdge / aspectLong, dimMultiple)
    if (shortEdge < dimMultiple) continue

    const width = options.aspect >= 1 ? longEdge : shortEdge
    const height = options.aspect >= 1 ? shortEdge : longEdge
    const size = `${width}x${height}` as const
    const valid = imageSizeValidate(size)
    if (valid.success)
      return createResult({
        width,
        height,
        size,
        aspect: width / height,
        pixels: width * height,
      })
  }

  return createResultError(op, `no valid size for aspect ${options.aspect.toFixed(4)}`)
}
