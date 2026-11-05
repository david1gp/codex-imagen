import * as a from "valibot"

export const imageComplexity = {
  low: "low",
  medium: "medium",
  high: "high",
} as const

export type ImageComplexity = (typeof imageComplexity)[keyof typeof imageComplexity]

export const imageComplexitySchema = a.enum(imageComplexity)
