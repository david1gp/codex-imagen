import * as a from "valibot"

export const imageBackground = {
  transparent: "transparent",
  opaque: "opaque",
  auto: "auto",
} as const

export type ImageBackground = (typeof imageBackground)[keyof typeof imageBackground]

export const imageBackgroundDefault = imageBackground.auto

export const imageBackgroundSchema = a.enum(imageBackground)
