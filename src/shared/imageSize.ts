import * as a from "valibot"

export const imageSizeCommon = {
  auto: "auto",
  square: "1024x1024",
  squareLarge: "1536x1536",
  squareMax: "2048x2048",
  landscape: "1536x1024",
  portrait: "1024x1536",
  landscapeWide: "1792x1024",
  widescreen: "2048x1152",
  widescreenPortrait: "1152x2048",
  panorama: "3072x1024",
} as const

export type ImageSizeCommon = keyof typeof imageSizeCommon
export type ImageSize = "auto" | `${number}x${number}`

export const imageSizeAuto = imageSizeCommon.auto

export const imageSizeSchema = a.pipe(
  a.string(),
  a.regex(/^(auto|\d+x\d+)$/, "size must be 'auto' or WxH, e.g. 1024x1024"),
)
