import * as a from "valibot"

export const imageQuality = {
  low: "low",
  medium: "medium",
  high: "high",
  auto: "auto",
} as const

export type ImageQuality = (typeof imageQuality)[keyof typeof imageQuality]

export const imageQualityDefault = imageQuality.auto

export const imageQualitySchema = a.enum(imageQuality)
