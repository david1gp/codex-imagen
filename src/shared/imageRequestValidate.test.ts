import { describe, expect, test } from "bun:test"
import { imageModel } from "./imageModel.js"
import { imageRequestValidate } from "./imageRequestValidate.js"

describe("imageRequestValidate gpt-image-2.5 support", () => {
  test("accepts custom sizes for gpt-image-2.5 models", () => {
    for (const model of [imageModel.gptImage25Sunburst, imageModel.gptImage25Flare]) {
      const result = imageRequestValidate({
        model,
        size: "2048x1152",
        quality: "auto",
        background: "opaque",
        inputFidelity: undefined,
        isEdit: false,
      })
      expect(result.success).toBe(true)
    }
  })

  test("accepts xhigh and max quality only for gpt-image-2.5 models", () => {
    for (const quality of ["xhigh", "max"] as const) {
      for (const model of [imageModel.gptImage25Sunburst, imageModel.gptImage25Flare]) {
        const result = imageRequestValidate({
          model,
          size: "1024x1024",
          quality,
          background: "opaque",
          inputFidelity: undefined,
          isEdit: false,
        })
        expect(result.success).toBe(true)
      }
      for (const model of [imageModel.gptImage2, imageModel.gptImage15, imageModel.gptImage1Mini]) {
        const result = imageRequestValidate({
          model,
          size: "1024x1024",
          quality,
          background: "opaque",
          inputFidelity: undefined,
          isEdit: false,
        })
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errorMessage).toContain("only supported by gpt-image-2.5")
      }
    }
  })

  test("accepts transparent background for gpt-image-2.5 models but not gpt-image-2", () => {
    for (const model of [imageModel.gptImage25Sunburst, imageModel.gptImage25Flare]) {
      const result = imageRequestValidate({
        model,
        size: "1024x1024",
        quality: "auto",
        background: "transparent",
        inputFidelity: undefined,
        isEdit: false,
      })
      expect(result.success).toBe(true)
    }
    const legacy = imageRequestValidate({
      model: imageModel.gptImage2,
      size: "1024x1024",
      quality: "auto",
      background: "transparent",
      inputFidelity: undefined,
      isEdit: false,
    })
    expect(legacy.success).toBe(false)
  })

  test("rejects input_fidelity for gpt-image-2 and gpt-image-2.5 models", () => {
    for (const model of [imageModel.gptImage2, imageModel.gptImage25Sunburst, imageModel.gptImage25Flare]) {
      const result = imageRequestValidate({
        model,
        size: "1024x1024",
        quality: "auto",
        background: "opaque",
        inputFidelity: "high",
        isEdit: true,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.errorMessage).toContain("input_fidelity is not supported")
    }
  })

  test("restricts gpt-image-1-mini input_fidelity to low", () => {
    const high = imageRequestValidate({
      model: imageModel.gptImage1Mini,
      size: "1024x1024",
      quality: "low",
      background: "opaque",
      inputFidelity: "high",
      isEdit: true,
    })
    expect(high.success).toBe(false)

    const low = imageRequestValidate({
      model: imageModel.gptImage1Mini,
      size: "1024x1024",
      quality: "low",
      background: "opaque",
      inputFidelity: "low",
      isEdit: true,
    })
    expect(low.success).toBe(true)
  })

  test("keeps legacy fixed sizes for gpt-image-1.5", () => {
    const rejected = imageRequestValidate({
      model: imageModel.gptImage15,
      size: "2048x1152",
      quality: "low",
      background: "opaque",
      inputFidelity: undefined,
      isEdit: false,
    })
    expect(rejected.success).toBe(false)

    const accepted = imageRequestValidate({
      model: imageModel.gptImage15,
      size: "1536x1024",
      quality: "low",
      background: "opaque",
      inputFidelity: "high",
      isEdit: true,
    })
    expect(accepted.success).toBe(true)
  })
})
