import { describe, expect, test } from "bun:test"
import { imageModel } from "../shared/imageModel.js"
import { imageRequestValidate, imageSizeConstraints } from "../shared/imageRequestValidate.js"
import { imageGridMultiplePlan } from "./imageGridMultiplePlan.js"

function planOrThrow(request: Parameters<typeof imageGridMultiplePlan>[0]) {
  const result = imageGridMultiplePlan(request)
  if (!result.success) throw new Error(result.errorMessage)
  return result.data
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

describe("imageGridMultiplePlan", () => {
  test("1920x512 x 10 -> 8 cells plus 2 cells without scaling below minimum", () => {
    const plan = planOrThrow({
      cellWidthPx: 1920,
      cellHeightPx: 512,
      cellCount: 10,
    })
    expect(plan.grids).toHaveLength(2)

    expect(plan.grids[0]).toMatchObject({
      cellStart: 0,
      cellCount: 8,
      cols: 2,
      rows: 4,
      requestSize: "3840x2048",
      slotWidthPx: 1920,
      slotHeightPx: 512,
      sliceWidthPx: 1920,
      sliceHeightPx: 512,
      cropCellToAspect: null,
    })
    expect(plan.grids[0]?.experimental).toBe(true)

    expect(plan.grids[1]).toMatchObject({
      cellStart: 8,
      cellCount: 2,
      cols: 1,
      rows: 2,
      requestSize: "1920x1024",
      slotWidthPx: 1920,
      slotHeightPx: 512,
      sliceWidthPx: 1920,
      sliceHeightPx: 512,
      cropCellToAspect: null,
    })
  })

  test("1920x400 x 1 -> expands canvas height to satisfy 3:1 GPT Image 2 ratio", () => {
    const plan = planOrThrow({
      cellWidthPx: 1920,
      cellHeightPx: 400,
      cellCount: 1,
    })
    expect(plan.grids).toHaveLength(1)
    expect(plan.grids[0]).toMatchObject({
      cellStart: 0,
      cellCount: 1,
      cols: 1,
      rows: 1,
      requestSize: "1920x640",
      slotWidthPx: 1920,
      slotHeightPx: 640,
      sliceWidthPx: 1920,
      sliceHeightPx: 640,
      cropCellToAspect: null,
    })
  })

  test("1920x400 x 1 can use an empty cell instead of cropping", () => {
    const plan = planOrThrow({
      cellWidthPx: 1920,
      cellHeightPx: 400,
      cellCount: 1,
      cropToCellAspect: true,
    })
    expect(plan.grids).toHaveLength(1)
    expect(plan.grids[0]).toMatchObject({
      cellCount: 1,
      capacityCellCount: 2,
      emptyCellCount: 1,
      cols: 1,
      rows: 2,
      requestSize: "1920x800",
      slotWidthPx: 1920,
      slotHeightPx: 400,
      sliceWidthPx: 1920,
      sliceHeightPx: 400,
      cropCellToAspect: null,
    })
  })

  test("1920x400 x 10 -> one valid grid at minimum slot resolution", () => {
    const plan = planOrThrow({
      cellWidthPx: 1920,
      cellHeightPx: 400,
      cellCount: 10,
    })
    expect(plan.grids).toHaveLength(1)
    expect(plan.grids[0]).toMatchObject({
      cellStart: 0,
      cellCount: 10,
      cols: 2,
      rows: 5,
      requestSize: "3840x2000",
      slotWidthPx: 1920,
      slotHeightPx: 400,
      cropCellToAspect: null,
    })
    expect(plan.grids[0]?.experimental).toBe(true)
  })

  test("1800x300 x 3 -> rounds up and stacks rows to satisfy GPT Image 2 rules", () => {
    const plan = planOrThrow({
      cellWidthPx: 1800,
      cellHeightPx: 300,
      cellCount: 3,
    })
    expect(plan.grids).toHaveLength(1)
    expect(plan.grids[0]).toMatchObject({
      cellStart: 0,
      cellCount: 3,
      cols: 1,
      rows: 3,
      requestSize: "1808x912",
      slotWidthPx: 1808,
      slotHeightPx: 304,
      sliceWidthPx: 1808,
      sliceHeightPx: 304,
      cropCellToAspect: null,
    })
  })

  test("1800x300 x 3 can enlarge cells to preserve aspect without empty cells", () => {
    const plan = planOrThrow({
      cellWidthPx: 1800,
      cellHeightPx: 300,
      cellCount: 3,
      cropToCellAspect: true,
    })
    expect(plan.grids).toHaveLength(1)
    expect(plan.grids[0]).toMatchObject({
      cellStart: 0,
      cellCount: 3,
      capacityCellCount: 3,
      emptyCellCount: 0,
      cols: 1,
      rows: 3,
      requestSize: "1824x912",
      slotWidthPx: 1824,
      slotHeightPx: 304,
      sliceWidthPx: 1824,
      sliceHeightPx: 304,
      cropCellToAspect: null,
    })
  })

  test("all planned request sizes satisfy GPT Image 2 hard rules and preserve minimum slice dimensions", () => {
    const cases = [
      { cellWidthPx: 1920, cellHeightPx: 512, cellCount: 10 },
      { cellWidthPx: 1920, cellHeightPx: 400, cellCount: 1 },
      { cellWidthPx: 1920, cellHeightPx: 400, cellCount: 10 },
      { cellWidthPx: 1800, cellHeightPx: 300, cellCount: 3 },
      {
        cellWidthPx: 1920,
        cellHeightPx: 400,
        cellCount: 1,
        cropToCellAspect: true,
      },
      {
        cellWidthPx: 1800,
        cellHeightPx: 300,
        cellCount: 3,
        cropToCellAspect: true,
      },
    ]

    for (const request of cases) {
      const plan = planOrThrow(request)
      for (const grid of plan.grids) {
        expect(requestSizeValid(grid.requestSize)).toBe(true)
        expect(grid.requestWidthPx % imageSizeConstraints.gptImage2DimMultiple).toBe(0)
        expect(grid.requestHeightPx % imageSizeConstraints.gptImage2DimMultiple).toBe(0)
        expect(Math.max(grid.requestWidthPx, grid.requestHeightPx)).toBeLessThanOrEqual(
          imageSizeConstraints.gptImage2MaxEdge,
        )
        expect(
          Math.max(grid.requestWidthPx, grid.requestHeightPx) / Math.min(grid.requestWidthPx, grid.requestHeightPx),
        ).toBeLessThanOrEqual(imageSizeConstraints.gptImage2RatioMax)
        expect(grid.pixels).toBeGreaterThanOrEqual(imageSizeConstraints.gptImage2MinPixels)
        expect(grid.pixels).toBeLessThanOrEqual(imageSizeConstraints.gptImage2MaxPixels)
        expect(grid.sliceWidthPx).toBeGreaterThanOrEqual(request.cellWidthPx)
        expect(grid.sliceHeightPx).toBeGreaterThanOrEqual(request.cellHeightPx)
      }
    }
  })

  test("rejects invalid minimum cell dimensions", () => {
    expect(imageGridMultiplePlan({ cellWidthPx: 0, cellHeightPx: 512, cellCount: 1 }).success).toBe(false)
    expect(
      imageGridMultiplePlan({
        cellWidthPx: 1920,
        cellHeightPx: 512.5,
        cellCount: 1,
      }).success,
    ).toBe(false)
    expect(
      imageGridMultiplePlan({
        cellWidthPx: 1920,
        cellHeightPx: 512,
        cellCount: 0,
      }).success,
    ).toBe(false)
  })
})
