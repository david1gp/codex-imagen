import { createResult, createResultError, type Result } from "#result"
import { imageSizePickBiggerThatFits } from "../shared/imageSizePickBiggerThatFits.js"
import { imageGridAspectSnap } from "./imageGridAspectSnap.js"
import { imageGridConfig } from "./imageGridConfig.js"

export type ImageGridPlanRequest = {
  cellAspect: number
  desiredCellShortEdgePx: number
  cellCount?: number
  fixed?: { cols: number; rows: number }
}

export type ImageGridPlan = {
  cols: number
  rows: number
  requestSize: `${number}x${number}`
  requestAspect: number
  cropCellToAspect: number | null
  distortionFree: boolean
  estCellShortEdgePx: number
}

type ImageGridPlanCandidate = ImageGridPlan

function imageGridLayoutCandidates(request: ImageGridPlanRequest): Array<{ cols: number; rows: number }> {
  if (request.fixed !== undefined) return [request.fixed]
  const count = request.cellCount ?? 0
  const pairs: Array<{ cols: number; rows: number }> = []
  for (let cols = 1; cols <= count; cols++) {
    if (count % cols === 0) pairs.push({ cols, rows: count / cols })
  }
  return pairs
}

function imageGridCandidateEvaluate(
  cols: number,
  rows: number,
  cellAspect: number,
  op: string,
): Result<ImageGridPlanCandidate> {
  const { honoredToleranceFraction, maxEdgePx } = imageGridConfig
  const naturalGridAspect = (cols * cellAspect) / rows
  const requestAspect = imageGridAspectSnap(naturalGridAspect)
  const distortionFree = Math.abs(requestAspect - naturalGridAspect) / naturalGridAspect <= honoredToleranceFraction
  const renderedCellAspect = requestAspect * (rows / cols)
  const keep = distortionFree
    ? 1
    : cellAspect < renderedCellAspect
      ? cellAspect / renderedCellAspect
      : renderedCellAspect / cellAspect

  const canvasResult = imageSizePickBiggerThatFits({ aspect: requestAspect, maxEdgePx })
  if (!canvasResult.success) return createResultError(op, canvasResult.errorMessage)
  const { width, height, size } = canvasResult.data
  const estCellShortEdgePx = Math.round(Math.min(width / cols, height / rows) * keep)

  return createResult({
    cols,
    rows,
    requestSize: size,
    requestAspect,
    cropCellToAspect: distortionFree ? null : cellAspect,
    distortionFree,
    estCellShortEdgePx,
  })
}

function imageGridCandidateBetter(candidate: ImageGridPlanCandidate, best: ImageGridPlanCandidate): boolean {
  if (candidate.distortionFree !== best.distortionFree) return candidate.distortionFree
  if (candidate.estCellShortEdgePx !== best.estCellShortEdgePx) {
    return candidate.estCellShortEdgePx > best.estCellShortEdgePx
  }
  const candidateSquareDistance = Math.abs(Math.log(candidate.requestAspect))
  const bestSquareDistance = Math.abs(Math.log(best.requestAspect))
  if (candidateSquareDistance !== bestSquareDistance) return candidateSquareDistance < bestSquareDistance
  return candidate.cols < best.cols
}

export function imageGridPlan(request: ImageGridPlanRequest): Result<ImageGridPlan> {
  const op = "imageGridPlan"
  const { cellAspect, desiredCellShortEdgePx, cellCount, fixed } = request

  if (!(cellAspect > 0)) return createResultError(op, `cellAspect must be > 0, got ${cellAspect}`)
  if (!(desiredCellShortEdgePx > 0)) {
    return createResultError(op, `desiredCellShortEdgePx must be > 0, got ${desiredCellShortEdgePx}`)
  }
  const hasCount = cellCount !== undefined
  const hasFixed = fixed !== undefined
  if (hasCount === hasFixed) return createResultError(op, "provide exactly one of cellCount or fixed")
  if (hasCount && !(cellCount >= 1)) return createResultError(op, `cellCount must be >= 1, got ${cellCount}`)
  if (hasFixed && !(fixed.cols > 0 && fixed.rows > 0)) {
    return createResultError(op, `fixed cols/rows must be > 0, got ${fixed.cols}x${fixed.rows}`)
  }

  let best: ImageGridPlanCandidate | undefined
  for (const { cols, rows } of imageGridLayoutCandidates(request)) {
    const candidateResult = imageGridCandidateEvaluate(cols, rows, cellAspect, op)
    if (!candidateResult.success) return candidateResult
    const candidate = candidateResult.data
    if (best === undefined || imageGridCandidateBetter(candidate, best)) best = candidate
  }

  if (best === undefined) return createResultError(op, "no candidate layout produced")
  return createResult(best)
}
