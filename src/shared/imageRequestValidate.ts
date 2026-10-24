import { createResult, createResultError, type Result } from "#result"

export const imageSizeConstraints = {
  dimMultiple: 16,
  maxEdge: 3840,
  minPixels: 655_360,
  maxPixels: 8_294_400,
  ratioMax: 3,
} as const

const SIZE_PATTERN = /^(\d+)x(\d+)$/

export function imageSizeValidate(size: string): Result<void> {
  const op = "imageSizeValidate"
  if (size === "auto") return createResult(undefined)
  const match = SIZE_PATTERN.exec(size)
  if (!match) return createResultError(op, `Invalid size '${size}'. Expected 'auto' or WxH.`)

  return imageSizeValidateDimensions(Number(match[1]), Number(match[2]))
}

export function imageSizeValidateDimensions(width: number, height: number): Result<void> {
  const op = "imageSizeValidateDimensions"
  const { dimMultiple, maxEdge, minPixels, maxPixels, ratioMax } = imageSizeConstraints

  if (width <= 0 || height <= 0) return createResultError(op, "size dimensions must be positive integers")
  if (width % dimMultiple !== 0 || height % dimMultiple !== 0) {
    return createResultError(op, `size dimensions must be multiples of ${dimMultiple}`)
  }
  if (Math.max(width, height) > maxEdge) {
    return createResultError(op, `size edges must be <= ${maxEdge} px`)
  }
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > ratioMax) {
    return createResultError(op, `size aspect ratio must be at most ${ratioMax}:1`)
  }
  const pixels = width * height
  if (pixels < minPixels || pixels > maxPixels) {
    return createResultError(op, `size total pixels must be between ${minPixels} and ${maxPixels}`)
  }
  return createResult(undefined)
}
