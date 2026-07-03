import { imageGridConfigSingle } from "./imageGridConfigSingle.js"

export function imageGridAspectSnapSingle(aspect: number): number {
  let best = imageGridConfigSingle.honoredAspects[0] ?? aspect
  let bestDistance = Number.POSITIVE_INFINITY
  for (const honored of imageGridConfigSingle.honoredAspects) {
    const distance = Math.abs(Math.log(aspect / honored))
    if (distance < bestDistance) {
      bestDistance = distance
      best = honored
    }
  }
  return best
}
