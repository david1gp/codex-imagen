import { imageGridConfig } from "./imageGridConfig.js"

export function imageGridAspectSnap(aspect: number): number {
  let best = imageGridConfig.honoredAspects[0] ?? aspect
  let bestDistance = Number.POSITIVE_INFINITY
  for (const honored of imageGridConfig.honoredAspects) {
    const distance = Math.abs(Math.log(aspect / honored))
    if (distance < bestDistance) {
      bestDistance = distance
      best = honored
    }
  }
  return best
}
