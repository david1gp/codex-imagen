import { createResult, createResultError, type Result } from "#result"

const SIZE_PATTERN = /^(\d+)x(\d+)$/

export type ImageSizeDimensions = {
  width: number
  height: number
}

export function imageSizeParse(size: string): Result<ImageSizeDimensions> {
  const op = "imageSizeParse"
  const match = SIZE_PATTERN.exec(size)
  if (!match) return createResultError(op, `Invalid size '${size}'. Expected WxH.`)

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return createResultError(op, `Invalid size '${size}'. Width and height must be positive integers.`)
  }

  return createResult({ width, height })
}
