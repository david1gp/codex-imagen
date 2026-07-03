import { describe, expect, test } from "bun:test"
import { imageModel } from "./imageModel.js"
import { imageSizeValidate } from "./imageRequestValidate.js"
import { imageSizePickBiggerThatFits } from "./imageSizePickBiggerThatFits.js"

function sizeOrThrow(aspect: number) {
  const result = imageSizePickBiggerThatFits({ aspect })
  if (!result.success) throw new Error(result.errorMessage)
  return result.data
}

describe("imageSizePickBiggerThatFits", () => {
  test("chooses the largest valid 1:1 canvas", () => {
    const picked = sizeOrThrow(1)
    expect(picked.size).toBe("2880x2880")
    expect(imageSizeValidate(imageModel.gptImage2, picked.size).success).toBe(true)
  })

  test("chooses a valid landscape 16:9 canvas", () => {
    const picked = sizeOrThrow(16 / 9)
    expect(picked.width).toBeGreaterThan(picked.height)
    expect(picked.aspect).toBeCloseTo(16 / 9, 2)
    expect(imageSizeValidate(imageModel.gptImage2, picked.size).success).toBe(true)
  })

  test("chooses a valid portrait 9:16 canvas", () => {
    const picked = sizeOrThrow(9 / 16)
    expect(picked.height).toBeGreaterThan(picked.width)
    expect(picked.aspect).toBeCloseTo(9 / 16, 2)
    expect(imageSizeValidate(imageModel.gptImage2, picked.size).success).toBe(true)
  })

  test("rejects invalid aspect", () => {
    expect(imageSizePickBiggerThatFits({ aspect: 0 }).success).toBe(false)
  })
})
