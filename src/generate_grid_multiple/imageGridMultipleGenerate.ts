import { createResult, createResultError, type Result } from "#result"
import {
  type ImageGridGenerateSingleOptions,
  imageGridGenerateSingle,
} from "../generate_grid_single/imageGridGenerateSingle.js"
import type { ImageGridCellSingle } from "../generate_grid_single/imageGridSliceSingle.js"
import type { ImageGridMultipleGridPlan, ImageGridMultiplePlan } from "./imageGridMultiplePlan.js"

export type ImageGridMultipleCell = Omit<ImageGridCellSingle, "col" | "row">

export type ImageGridMultipleGenerateOptions = Omit<
  ImageGridGenerateSingleOptions,
  "gridOutputPath" | "cells" | "cols" | "rows" | "size" | "cropCellToAspect" | "cropPaddingFraction"
> & {
  plan: ImageGridMultiplePlan
  cells: ImageGridMultipleCell[]
  gridOutputPath: (grid: ImageGridMultipleGridPlan) => string
  cropPaddingFraction?: number
}

export type ImageGridMultipleGenerateResult = {
  gridPaths: string[]
  cellPaths: string[]
}

export async function imageGridMultipleGenerate(
  options: ImageGridMultipleGenerateOptions,
): Promise<Result<ImageGridMultipleGenerateResult>> {
  const op = "imageGridMultipleGenerate"
  const { plan, cells, gridOutputPath, cropPaddingFraction = 0, ...singleOptions } = options
  const expectedCellCount = plan.grids.reduce((sum, grid) => sum + grid.cellCount, 0)
  if (cells.length !== expectedCellCount) {
    return createResultError(op, `cells length must match plan cellCount ${expectedCellCount}, got ${cells.length}`)
  }

  const gridPaths: string[] = []
  const cellPaths: string[] = []

  for (const grid of plan.grids) {
    const gridCells: ImageGridCellSingle[] = cells
      .slice(grid.cellStart, grid.cellStart + grid.cellCount)
      .map((cell, index) => ({
        ...cell,
        col: index % grid.cols,
        row: Math.floor(index / grid.cols),
      }))

    const result = await imageGridGenerateSingle({
      ...singleOptions,
      gridOutputPath: gridOutputPath(grid),
      cells: gridCells,
      cols: grid.cols,
      rows: grid.rows,
      size: grid.requestSize,
      cropCellToAspect: grid.cropCellToAspect,
      cropPaddingFraction,
    })
    if (!result.success) return result

    gridPaths.push(result.data.gridPath)
    cellPaths.push(...result.data.cellPaths)
  }

  return createResult({ gridPaths, cellPaths })
}
