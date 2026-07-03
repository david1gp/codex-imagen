import * as a from "valibot"

export const imageModel = {
  gptImage2: "gpt-image-2",
  gptImage15: "gpt-image-1.5",
  gptImage1: "gpt-image-1",
  gptImage1Mini: "gpt-image-1-mini",
} as const

export type ImageModel = (typeof imageModel)[keyof typeof imageModel]

export const imageModelDefault = imageModel.gptImage2

export const imageModelSchema = a.enum(imageModel)
