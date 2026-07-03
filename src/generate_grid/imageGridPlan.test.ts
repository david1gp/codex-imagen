import { describe, expect, test } from "bun:test"
import { imageModel } from "../shared/imageModel.js"
import { imageRequestValidate } from "../shared/imageRequestValidate.js"
import { imageGridConfig } from "./imageGridConfig.js"
import { imageGridPlan } from "./imageGridPlan.js"

const DESIRED = imageGridConfig.desiredCellShortEdgeDefaultPx

function planOrThrow(request: Parameters<typeof imageGridPlan>[0]) {
  const result = imageGridPlan(request)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data
}

function honored(aspect: number): boolean {
  return imageGridConfig.honoredAspects.some((value) => Math.abs(value - aspect) < 1e-9)
}

function requestSizeValid(size: string): boolean {
  return imageRequestValidate({
    model: imageModel.gptImage2,
    size,
    background: "opaque",
    inputFidelity: undefined,
    isEdit: false,
  }).success
}

describe("imageGridPlan free mode", () => {
  test("1:1 x 4 -> 2x2, distortion-free, no crop, square request", () => {
    const plan = planOrThrow({ cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 4 })
    expect(plan.cols).toBe(2)
    expect(plan.rows).toBe(2)
    expect(plan.distortionFree).toBe(true)
    expect(plan.cropCellToAspect).toBeNull()
    expect(plan.requestAspect).toBeCloseTo(1.0, 5)
  })

  test("2:1 x 2 -> 1x2, distortion-free, cells render 2:1", () => {
    const plan = planOrThrow({ cellAspect: 2, desiredCellShortEdgePx: DESIRED, cellCount: 2 })
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(2)
    expect(plan.distortionFree).toBe(true)
    expect(plan.cropCellToAspect).toBeNull()
    expect(plan.requestAspect).toBeCloseTo(1.0, 5)
  })

  test("2:1 x 4 -> cropped to 2, honored request aspect, max resolution among crop candidates", () => {
    const plan = planOrThrow({ cellAspect: 2, desiredCellShortEdgePx: DESIRED, cellCount: 4 })
    expect(plan.distortionFree).toBe(false)
    expect(plan.cropCellToAspect).toBe(2)
    expect(honored(plan.requestAspect)).toBe(true)

    const factorPairs = [
      { cols: 1, rows: 4 },
      { cols: 2, rows: 2 },
      { cols: 4, rows: 1 },
    ]
    const bestEst = Math.max(
      ...factorPairs.map(
        (fixed) => planOrThrow({ cellAspect: 2, desiredCellShortEdgePx: DESIRED, fixed }).estCellShortEdgePx,
      ),
    )
    expect(plan.estCellShortEdgePx).toBe(bestEst)
  })

  test("1:1 x 16 -> 4x4, distortion-free", () => {
    const plan = planOrThrow({ cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 16 })
    expect(plan.cols).toBe(4)
    expect(plan.rows).toBe(4)
    expect(plan.distortionFree).toBe(true)
  })
})

describe("imageGridPlan batch mode", () => {
  test("cols 4 x rows 3, cell 2:1 -> snap to 16:9 and crop to 2", () => {
    const plan = planOrThrow({ cellAspect: 2, desiredCellShortEdgePx: DESIRED, fixed: { cols: 4, rows: 3 } })
    expect(plan.cols).toBe(4)
    expect(plan.rows).toBe(3)
    expect(plan.requestAspect).toBeCloseTo(1.7778, 3)
    expect(plan.cropCellToAspect).toBe(2)
    expect(plan.distortionFree).toBe(false)
  })

  test("cols 4 x rows 4, cell 1:1 -> distortion-free", () => {
    const plan = planOrThrow({ cellAspect: 1, desiredCellShortEdgePx: DESIRED, fixed: { cols: 4, rows: 4 } })
    expect(plan.distortionFree).toBe(true)
    expect(plan.cropCellToAspect).toBeNull()
  })
})

describe("imageGridPlan invariants", () => {
  const cases: Array<Parameters<typeof imageGridPlan>[0]> = [
    { cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 2, desiredCellShortEdgePx: DESIRED, cellCount: 2 },
    { cellAspect: 2, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 16 },
    { cellAspect: 3, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 2, desiredCellShortEdgePx: DESIRED, fixed: { cols: 4, rows: 3 } },
    { cellAspect: 1, desiredCellShortEdgePx: DESIRED, fixed: { cols: 4, rows: 4 } },
  ]

  test("requestSize is valid; requestAspect honored; est > 0", () => {
    for (const request of cases) {
      const plan = planOrThrow(request)
      expect(requestSizeValid(plan.requestSize)).toBe(true)
      expect(honored(plan.requestAspect)).toBe(true)
      expect(plan.estCellShortEdgePx).toBeGreaterThan(0)
    }
  })
})

describe("imageGridPlan validation", () => {
  test("rejects non-positive cell aspect", () => {
    expect(imageGridPlan({ cellAspect: 0, desiredCellShortEdgePx: DESIRED, cellCount: 4 }).success).toBe(false)
  })

  test("rejects both / neither of cellCount and fixed", () => {
    expect(
      imageGridPlan({ cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 4, fixed: { cols: 2, rows: 2 } })
        .success,
    ).toBe(false)
    expect(imageGridPlan({ cellAspect: 1, desiredCellShortEdgePx: DESIRED }).success).toBe(false)
  })
})
