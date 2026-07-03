import { imageSizeConstraints } from "../shared/imageRequestValidate.js"

export const imageGridConfig = {
  honoredAspects: [0.5625, 0.6667, 1.0, 1.5, 1.7778] as readonly number[],
  honoredToleranceFraction: 0.04,
  desiredCellShortEdgeDefaultPx: 256,
  maxEdgePx: 3072,
  edgeMultiplePx: imageSizeConstraints.gptImage2DimMultiple,
  cropPaddingFraction: 0.012,
} as const
