import * as a from "valibot"

export const imageModel = {
  gptImage25Sunburst: "gpt-image-2.5-sunburst",
  gptImage25Flare: "gpt-image-2.5-flare",
} as const

export type ImageModel = (typeof imageModel)[keyof typeof imageModel]

export const imageModelDefault = imageModel.gptImage25Sunburst

export const imageModelSchema = a.enum(imageModel)
