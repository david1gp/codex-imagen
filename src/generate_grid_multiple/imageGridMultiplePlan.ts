import { createResult, createResultError, type Result } from "#result"
import { imageSizeConstraints, imageSizeValidateGptImage2 } from "../shared/imageRequestValidate.js"

export type ImageGridMultiplePlanRequest = {
  cellWidthPx: number
  cellHeightPx: number
  cellCount: number
  cropToCellAspect?: boolean
  maxEdgePx?: number
  maxCellsPerGrid?: number
}

export type ImageGridMultipleGridPlan = {
  gridIndex: number
  cellStart: number
  cellCount: number
  capacityCellCount: number
  emptyCellCount: number
  cols: number
  rows: number
  requestSize: `${number}x${number}`
  requestWidthPx: number
  requestHeightPx: number
  requestAspect: number
  pixels: number
  slotWidthPx: number
  slotHeightPx: number
  sliceWidthPx: number
  sliceHeightPx: number
  cropCellToAspect: number | null
  experimental: boolean
}

export type ImageGridMultiplePlan = {
  cellWidthPx: number
  cellHeightPx: number
  cellCount: number
  grids: ImageGridMultipleGridPlan[]
}

type ImageGridMultipleCandidate = Omit<ImageGridMultipleGridPlan, "gridIndex" | "cellStart">

const experimentalPixelThreshold = 2560 * 1440

function ceilToMultiple(value: number, multiple: number): number {
  return Math.ceil(value / multiple) * multiple
}

function containedAspectSize(width: number, height: number, aspect: number): { width: number; height: number } {
  const currentAspect = width / height
  if (currentAspect > aspect) return { width: height * aspect, height }
  return { width, height: width / aspect }
}

function imageGridMultipleCandidateBetter(
  candidate: ImageGridMultipleCandidate,
  best: ImageGridMultipleCandidate,
): boolean {
  if (candidate.cellCount !== best.cellCount) return candidate.cellCount > best.cellCount
  if ((candidate.cropCellToAspect === null) !== (best.cropCellToAspect === null))
    return candidate.cropCellToAspect === null
  if (candidate.emptyCellCount !== best.emptyCellCount) return candidate.emptyCellCount < best.emptyCellCount
  if (candidate.pixels !== best.pixels) return candidate.pixels < best.pixels

  const candidateSquareDistance = Math.abs(Math.log(candidate.requestAspect))
  const bestSquareDistance = Math.abs(Math.log(best.requestAspect))
  if (candidateSquareDistance !== bestSquareDistance) return candidateSquareDistance < bestSquareDistance

  return candidate.cols > best.cols
}

function imageGridMultipleAspectCandidateCreate(
  cellCount: number,
  cols: number,
  rows: number,
  cellWidthPx: number,
  cellHeightPx: number,
  maxEdgePx: number,
): ImageGridMultipleCandidate | undefined {
  const capacityCellCount = cols * rows
  if (capacityCellCount < cellCount) return undefined

  const { gptImage2DimMultiple } = imageSizeConstraints
  const minWidth = ceilToMultiple(cols * cellWidthPx, gptImage2DimMultiple)
  const minHeight = ceilToMultiple(rows * cellHeightPx, gptImage2DimMultiple)
  let best: ImageGridMultipleCandidate | undefined

  for (let width = minWidth; width <= maxEdgePx; width += gptImage2DimMultiple) {
    if (width % cols !== 0) continue

    for (let height = minHeight; height <= maxEdgePx; height += gptImage2DimMultiple) {
      if (height % rows !== 0) continue
      const valid = imageSizeValidateGptImage2(width, height)
      if (!valid.success) continue

      const slotWidthPx = width / cols
      const slotHeightPx = height / rows
      if (slotWidthPx * cellHeightPx !== slotHeightPx * cellWidthPx) continue

      const pixels = width * height
      const candidate: ImageGridMultipleCandidate = {
        cellCount,
        capacityCellCount,
        emptyCellCount: capacityCellCount - cellCount,
        cols,
        rows,
        requestSize: `${width}x${height}`,
        requestWidthPx: width,
        requestHeightPx: height,
        requestAspect: width / height,
        pixels,
        slotWidthPx,
        slotHeightPx,
        sliceWidthPx: slotWidthPx,
        sliceHeightPx: slotHeightPx,
        cropCellToAspect: null,
        experimental: pixels > experimentalPixelThreshold,
      }

      if (best === undefined || imageGridMultipleCandidateBetter(candidate, best)) best = candidate
    }
  }

  return best
}

function imageGridMultipleCandidateCreate(
  cellCount: number,
  cols: number,
  rows: number,
  cellWidthPx: number,
  cellHeightPx: number,
  cropToCellAspect: boolean,
  maxEdgePx: number,
): ImageGridMultipleCandidate | undefined {
  const { gptImage2DimMultiple } = imageSizeConstraints
  const minWidth = ceilToMultiple(cols * cellWidthPx, gptImage2DimMultiple)
  const minHeight = ceilToMultiple(rows * cellHeightPx, gptImage2DimMultiple)
  const cellAspect = cellWidthPx / cellHeightPx
  let best: ImageGridMultipleCandidate | undefined

  for (let width = minWidth; width <= maxEdgePx; width += gptImage2DimMultiple) {
    if (width % cols !== 0) continue

    for (let height = minHeight; height <= maxEdgePx; height += gptImage2DimMultiple) {
      if (height % rows !== 0) continue

      const valid = imageSizeValidateGptImage2(width, height)
      if (!valid.success) continue

      const slotWidthPx = width / cols
      const slotHeightPx = height / rows
      const slice = cropToCellAspect ? containedAspectSize(slotWidthPx, slotHeightPx, cellAspect) : undefined
      const sliceWidthPx = slice?.width ?? slotWidthPx
      const sliceHeightPx = slice?.height ?? slotHeightPx

      if (sliceWidthPx < cellWidthPx || sliceHeightPx < cellHeightPx) continue

      const pixels = width * height
      const capacityCellCount = cols * rows
      const candidate: ImageGridMultipleCandidate = {
        cellCount,
        capacityCellCount,
        emptyCellCount: capacityCellCount - cellCount,
        cols,
        rows,
        requestSize: `${width}x${height}`,
        requestWidthPx: width,
        requestHeightPx: height,
        requestAspect: width / height,
        pixels,
        slotWidthPx,
        slotHeightPx,
        sliceWidthPx,
        sliceHeightPx,
        cropCellToAspect: cropToCellAspect ? cellAspect : null,
        experimental: pixels > experimentalPixelThreshold,
      }

      if (best === undefined || imageGridMultipleCandidateBetter(candidate, best)) best = candidate
    }
  }

  return best
}

function imageGridMultipleAspectCandidatesForCellCount(
  cellCount: number,
  cellWidthPx: number,
  cellHeightPx: number,
  maxEdgePx: number,
): ImageGridMultipleCandidate[] {
  const candidates: ImageGridMultipleCandidate[] = []
  const maxCols = Math.floor(maxEdgePx / cellWidthPx)
  const maxRows = Math.floor(maxEdgePx / cellHeightPx)

  for (let cols = 1; cols <= maxCols; cols++) {
    for (let rows = 1; rows <= maxRows; rows++) {
      const candidate = imageGridMultipleAspectCandidateCreate(
        cellCount,
        cols,
        rows,
        cellWidthPx,
        cellHeightPx,
        maxEdgePx,
      )
      if (candidate !== undefined) candidates.push(candidate)
    }
  }

  return candidates
}

function imageGridMultipleCandidatesForCellCount(
  cellCount: number,
  cellWidthPx: number,
  cellHeightPx: number,
  cropToCellAspect: boolean,
  maxEdgePx: number,
): ImageGridMultipleCandidate[] {
  const candidates: ImageGridMultipleCandidate[] = []
  for (let cols = 1; cols <= cellCount; cols++) {
    if (cellCount % cols !== 0) continue
    const rows = cellCount / cols
    const candidate = imageGridMultipleCandidateCreate(
      cellCount,
      cols,
      rows,
      cellWidthPx,
      cellHeightPx,
      cropToCellAspect,
      maxEdgePx,
    )
    if (candidate !== undefined) candidates.push(candidate)
  }
  return candidates
}

export function imageGridMultiplePlan(request: ImageGridMultiplePlanRequest): Result<ImageGridMultiplePlan> {
  const op = "imageGridMultiplePlan"
  const { cellWidthPx, cellHeightPx, cellCount } = request
  const cropToCellAspect = request.cropToCellAspect ?? false
  const maxEdgePx = Math.min(
    request.maxEdgePx ?? imageSizeConstraints.gptImage2MaxEdge,
    imageSizeConstraints.gptImage2MaxEdge,
  )
  const maxCellsPerGrid = request.maxCellsPerGrid ?? cellCount

  if (!(Number.isInteger(cellWidthPx) && cellWidthPx > 0)) {
    return createResultError(op, `cellWidthPx must be a positive integer, got ${cellWidthPx}`)
  }
  if (!(Number.isInteger(cellHeightPx) && cellHeightPx > 0)) {
    return createResultError(op, `cellHeightPx must be a positive integer, got ${cellHeightPx}`)
  }
  if (!(Number.isInteger(cellCount) && cellCount >= 1)) {
    return createResultError(op, `cellCount must be a positive integer, got ${cellCount}`)
  }
  if (!(Number.isInteger(maxEdgePx) && maxEdgePx > 0)) {
    return createResultError(op, `maxEdgePx must be a positive integer, got ${request.maxEdgePx}`)
  }
  if (!(Number.isInteger(maxCellsPerGrid) && maxCellsPerGrid >= 1)) {
    return createResultError(op, `maxCellsPerGrid must be a positive integer, got ${request.maxCellsPerGrid}`)
  }

  const grids: ImageGridMultipleGridPlan[] = []
  let remaining = cellCount
  let cellStart = 0

  while (remaining > 0) {
    let best: ImageGridMultipleCandidate | undefined
    const limit = Math.min(remaining, maxCellsPerGrid)
    for (let candidateCellCount = 1; candidateCellCount <= limit; candidateCellCount++) {
      const candidates = cropToCellAspect
        ? imageGridMultipleAspectCandidatesForCellCount(candidateCellCount, cellWidthPx, cellHeightPx, maxEdgePx)
        : imageGridMultipleCandidatesForCellCount(
            candidateCellCount,
            cellWidthPx,
            cellHeightPx,
            cropToCellAspect,
            maxEdgePx,
          )
      for (const candidate of candidates) {
        if (best === undefined || imageGridMultipleCandidateBetter(candidate, best)) best = candidate
      }
    }

    if (best === undefined && cropToCellAspect) {
      for (let candidateCellCount = 1; candidateCellCount <= limit; candidateCellCount++) {
        const candidates = imageGridMultipleCandidatesForCellCount(
          candidateCellCount,
          cellWidthPx,
          cellHeightPx,
          cropToCellAspect,
          maxEdgePx,
        )
        for (const candidate of candidates) {
          if (best === undefined || imageGridMultipleCandidateBetter(candidate, best)) best = candidate
        }
      }
    }

    if (best === undefined) {
      return createResultError(op, `no valid grid can contain a ${cellWidthPx}x${cellHeightPx} cell`)
    }

    grids.push({ ...best, gridIndex: grids.length, cellStart })
    remaining -= best.cellCount
    cellStart += best.cellCount
  }

  return createResult({ cellWidthPx, cellHeightPx, cellCount, grids })
}
