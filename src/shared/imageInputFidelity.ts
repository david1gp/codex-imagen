import * as a from "valibot"

export const imageInputFidelity = {
  low: "low",
  high: "high",
} as const

export type ImageInputFidelity = (typeof imageInputFidelity)[keyof typeof imageInputFidelity]

export const imageInputFidelityDefault = imageInputFidelity.low

export const imageInputFidelitySchema = a.enum(imageInputFidelity)
