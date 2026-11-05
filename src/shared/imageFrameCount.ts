import * as a from "valibot"

export const imageFrameCountMin = 2
export const imageFrameCountMax = 64
export const imageFrameCountDefault = 9

export const imageFrameCountSchema = a.pipe(
  a.number(),
  a.integer(),
  a.minValue(imageFrameCountMin),
  a.maxValue(imageFrameCountMax),
)
