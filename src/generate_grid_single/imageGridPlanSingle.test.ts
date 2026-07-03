import { describe, expect, test } from "bun:test"
import { imageModel } from "../shared/imageModel.js"
import { imageRequestValidate } from "../shared/imageRequestValidate.js"
import { imageGridConfigSingle } from "./imageGridConfigSingle.js"
import { imageGridPlanSingle } from "./imageGridPlanSingle.js"

const DESIRED = imageGridConfigSingle.desiredCellShortEdgeDefaultPx

function planOrThrow(request: Parameters<typeof imageGridPlanSingle>[0]) {
  const result = imageGridPlanSingle(request)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data
}

function honored(aspect: number): boolean {
  return imageGridConfigSingle.honoredAspects.some((value) => Math.abs(value - aspect) < 1e-9)
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

describe("imageGridPlanSingle free mode", () => {
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

  test("1920x400 x 1 -> 1x1, 16:9 request, crop to 4.8", () => {
    const plan = planOrThrow({ cellAspect: 1920 / 400, desiredCellShortEdgePx: DESIRED, cellCount: 1 })
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(1)
    expect(plan.requestSize).toBe("3072x1728")
    expect(plan.requestAspect).toBeCloseTo(1.7778, 5)
    expect(plan.distortionFree).toBe(false)
    expect(plan.cropCellToAspect).toBe(1920 / 400)
    expect(plan.estCellShortEdgePx).toBe(640)
  })

  test("1920x512 x 1 -> 1x1, 16:9 request, crop to 3.75", () => {
    const plan = planOrThrow({ cellAspect: 1920 / 512, desiredCellShortEdgePx: DESIRED, cellCount: 1 })
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(1)
    expect(plan.requestSize).toBe("3072x1728")
    expect(plan.requestAspect).toBeCloseTo(1.7778, 5)
    expect(plan.distortionFree).toBe(false)
    expect(plan.cropCellToAspect).toBe(1920 / 512)
    expect(plan.estCellShortEdgePx).toBe(819)
  })

  test("1920x400 x 4 -> 1x4, square request, crop to 4.8", () => {
    const plan = planOrThrow({ cellAspect: 1920 / 400, desiredCellShortEdgePx: DESIRED, cellCount: 4 })
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(4)
    expect(plan.requestSize).toBe("2880x2880")
    expect(plan.requestAspect).toBeCloseTo(1.0, 5)
    expect(plan.distortionFree).toBe(false)
    expect(plan.cropCellToAspect).toBe(1920 / 400)
    expect(plan.estCellShortEdgePx).toBe(600)
  })

  test("1920x512 x 4 -> 1x4, square request, crop to 3.75", () => {
    const plan = planOrThrow({ cellAspect: 1920 / 512, desiredCellShortEdgePx: DESIRED, cellCount: 4 })
    expect(plan.cols).toBe(1)
    expect(plan.rows).toBe(4)
    expect(plan.requestSize).toBe("2880x2880")
    expect(plan.requestAspect).toBeCloseTo(1.0, 5)
    expect(plan.distortionFree).toBe(false)
    expect(plan.cropCellToAspect).toBe(1920 / 512)
    expect(plan.estCellShortEdgePx).toBe(675)
  })

  test("1920x512 x 10 -> 2x5, distortion-free 1.5 request", () => {
    const plan = planOrThrow({ cellAspect: 1920 / 512, desiredCellShortEdgePx: DESIRED, cellCount: 10 })
    expect(plan.cols).toBe(2)
    expect(plan.rows).toBe(5)
    expect(plan.requestSize).toBe("3072x2048")
    expect(plan.requestAspect).toBeCloseTo(1.5, 5)
    expect(plan.distortionFree).toBe(true)
    expect(plan.cropCellToAspect).toBeNull()
    expect(plan.estCellShortEdgePx).toBe(410)
  })
})

describe("imageGridPlanSingle batch mode", () => {
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

describe("imageGridPlanSingle invariants", () => {
  const cases: Array<Parameters<typeof imageGridPlanSingle>[0]> = [
    { cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 2, desiredCellShortEdgePx: DESIRED, cellCount: 2 },
    { cellAspect: 2, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 16 },
    { cellAspect: 3, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 1920 / 400, desiredCellShortEdgePx: DESIRED, cellCount: 1 },
    { cellAspect: 1920 / 512, desiredCellShortEdgePx: DESIRED, cellCount: 1 },
    { cellAspect: 1920 / 400, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 1920 / 512, desiredCellShortEdgePx: DESIRED, cellCount: 4 },
    { cellAspect: 1920 / 512, desiredCellShortEdgePx: DESIRED, cellCount: 10 },
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

describe("imageGridPlanSingle validation", () => {
  test("rejects non-positive cell aspect", () => {
    expect(imageGridPlanSingle({ cellAspect: 0, desiredCellShortEdgePx: DESIRED, cellCount: 4 }).success).toBe(false)
  })

  test("rejects both / neither of cellCount and fixed", () => {
    expect(
      imageGridPlanSingle({ cellAspect: 1, desiredCellShortEdgePx: DESIRED, cellCount: 4, fixed: { cols: 2, rows: 2 } })
        .success,
    ).toBe(false)
    expect(imageGridPlanSingle({ cellAspect: 1, desiredCellShortEdgePx: DESIRED }).success).toBe(false)
  })
})
