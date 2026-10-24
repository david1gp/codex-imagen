import { describe, expect, test } from "bun:test"
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
    expect(imageSizeValidate(picked.size).success).toBe(true)
  })

  test("chooses a valid landscape 16:9 canvas", () => {
    const picked = sizeOrThrow(16 / 9)
    expect(picked.width).toBeGreaterThan(picked.height)
    expect(picked.aspect).toBeCloseTo(16 / 9, 2)
    expect(imageSizeValidate(picked.size).success).toBe(true)
  })

  test("chooses a valid portrait 9:16 canvas", () => {
    const picked = sizeOrThrow(9 / 16)
    expect(picked.height).toBeGreaterThan(picked.width)
    expect(picked.aspect).toBeCloseTo(9 / 16, 2)
    expect(imageSizeValidate(picked.size).success).toBe(true)
  })

  test("rejects invalid aspect", () => {
    expect(imageSizePickBiggerThatFits({ aspect: 0 }).success).toBe(false)
  })
})

describe("imageSizeValidate", () => {
  test("accepts auto and constrained sizes", () => {
    for (const size of ["auto", "1024x1024", "2048x1152", "3840x2160"]) {
      expect(imageSizeValidate(size).success).toBe(true)
    }
  })

  test("rejects sizes outside the shared constraints", () => {
    for (const size of ["100x100", "1024x1023", "4096x1024", "bogus"]) {
      expect(imageSizeValidate(size).success).toBe(false)
    }
  })
})
