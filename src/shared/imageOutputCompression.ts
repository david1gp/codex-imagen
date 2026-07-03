import * as a from "valibot"

export const imageOutputCompressionMin = 0
export const imageOutputCompressionMax = 100
export const imageOutputCompressionDefault = 100

export const imageOutputCompressionSchema = a.pipe(
  a.number(),
  a.integer(),
  a.minValue(imageOutputCompressionMin),
  a.maxValue(imageOutputCompressionMax),
)
