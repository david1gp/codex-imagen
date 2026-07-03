import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { createResult, createResultError, type Result } from "#result"
import { imageAltClean } from "../shared/imageAltClean.js"
import { imageGridConfig } from "./imageGridConfig.js"

export type ImageGridCell = {
  col: number
  row: number
  outputPath: string
  prompt?: string
}

export type ImageGridSliceOptions = {
  gridPath: string
  cols: number
  rows: number
  cells: ImageGridCell[]
  cropCellToAspect?: number | null
  cropPaddingFraction?: number
  writeTxt?: boolean
}

function imageGridDimensions(gridPath: string): { width: number; height: number } {
  const [width, height] = execFileSync("magick", ["identify", "-format", "%w %h", gridPath])
    .toString()
    .trim()
    .split(" ")
    .map(Number)
  return { width: width ?? 0, height: height ?? 0 }
}

function imageGridCellCropRect(
  cellW: number,
  cellH: number,
  targetAspect: number,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const cellAspect = cellW / cellH
  if (targetAspect < cellAspect) {
    const width = Math.round(cellH * targetAspect)
    return { width, height: cellH, offsetX: Math.round((cellW - width) / 2), offsetY: 0 }
  }
  const height = Math.round(cellW / targetAspect)
  return { width: cellW, height, offsetX: 0, offsetY: Math.round((cellH - height) / 2) }
}

export function imageGridSlice(options: ImageGridSliceOptions): Result<string[]> {
  const op = "imageGridSlice"
  const {
    gridPath,
    cols,
    rows,
    cells,
    cropCellToAspect,
    cropPaddingFraction = imageGridConfig.cropPaddingFraction,
    writeTxt = true,
  } = options

  if (!(cols > 0 && rows > 0)) return createResultError(op, `cols/rows must be > 0, got ${cols}x${rows}`)

  try {
    const { width, height } = imageGridDimensions(gridPath)
    if (width === 0 || height === 0) return createResultError(op, `could not read grid dimensions: ${gridPath}`)

    const cellW = width / cols
    const cellH = height / rows
    const padX = cellW * cropPaddingFraction
    const padY = cellH * cropPaddingFraction
    const shavedW = Math.round(cellW - padX * 2)
    const shavedH = Math.round(cellH - padY * 2)
    const crop = cropCellToAspect != null ? imageGridCellCropRect(shavedW, shavedH, cropCellToAspect) : undefined
    const cropW = crop?.width ?? shavedW
    const cropH = crop?.height ?? shavedH
    const cropOffsetX = crop?.offsetX ?? 0
    const cropOffsetY = crop?.offsetY ?? 0

    const outputPaths: string[] = []
    for (const { col, row, outputPath, prompt } of cells) {
      mkdirSync(dirname(outputPath), { recursive: true })
      const x = Math.round(col * cellW + padX) + cropOffsetX
      const y = Math.round(row * cellH + padY) + cropOffsetY
      execFileSync("magick", [gridPath, "-crop", `${cropW}x${cropH}+${x}+${y}`, "+repage", outputPath])
      if (writeTxt && prompt !== undefined)
        writeFileSync(outputPath.replace(/\.[^.]*$/, ".txt"), `${imageAltClean(prompt)}\n`)
      outputPaths.push(outputPath)
    }

    return createResult(outputPaths)
  } catch (error) {
    return createResultError(op, error instanceof Error ? error.message : String(error))
  }
}
