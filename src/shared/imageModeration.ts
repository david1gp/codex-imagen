import * as a from "valibot"

export const imageModeration = {
  auto: "auto",
  low: "low",
} as const

export type ImageModeration = (typeof imageModeration)[keyof typeof imageModeration]

export const imageModerationDefault = imageModeration.auto

export const imageModerationSchema = a.enum(imageModeration)
