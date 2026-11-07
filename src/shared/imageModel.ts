import * as a from "valibot"

export const imageModel = {
  gptImage2: "gpt-image-2",
  gptImage26Sunburst: "gpt-image-2.6-sunburst",
  gptImage26Flare: "gpt-image-2.6-flare",
} as const

export type ImageModel = (typeof imageModel)[keyof typeof imageModel]

export const imageModelDefault = imageModel.gptImage26Sunburst

export const imageModelSchema = a.enum(imageModel)
