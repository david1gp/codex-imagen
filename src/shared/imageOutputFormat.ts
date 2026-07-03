import * as a from "valibot"

export const imageOutputFormat = {
  png: "png",
  jpeg: "jpeg",
  webp: "webp",
} as const

export type ImageOutputFormat = (typeof imageOutputFormat)[keyof typeof imageOutputFormat]

export const imageOutputFormatDefault = imageOutputFormat.png

export const imageOutputFormatSchema = a.enum(imageOutputFormat)

export const imageOutputFormatExtension: Record<ImageOutputFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
}
