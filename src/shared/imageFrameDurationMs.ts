import * as a from "valibot"

export const imageFrameDurationMsMin = 20
export const imageFrameDurationMsMax = 2000
export const imageFrameDurationMsDefault = 200

export const imageFrameDurationMsSchema = a.pipe(
  a.number(),
  a.integer(),
  a.minValue(imageFrameDurationMsMin),
  a.maxValue(imageFrameDurationMsMax),
)
