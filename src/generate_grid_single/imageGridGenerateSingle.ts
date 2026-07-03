import { createResult, type Result } from "#result"
import { codexImageGenerate } from "../generate_single/codexImageGenerate.js"
import type { CodexImagenClientInput } from "../shared/codexImagenClient.js"
import type { ImageBackground } from "../shared/imageBackground.js"
import type { ImageModel } from "../shared/imageModel.js"
import type { ImageModeration } from "../shared/imageModeration.js"
import type { ImageOutputFormat } from "../shared/imageOutputFormat.js"
import type { ImageQuality } from "../shared/imageQuality.js"
import { type ImageGridCellSingle, imageGridSliceSingle } from "./imageGridSliceSingle.js"

export type ImageGridGenerateSingleOptions = {
  client: CodexImagenClientInput
  prompt: string
  gridOutputPath: string
  cells: ImageGridCellSingle[]
  cols: number
  rows: number
  size: string
  cropCellToAspect?: number | null
  model?: ImageModel
  quality?: ImageQuality
  background?: ImageBackground
  outputFormat?: ImageOutputFormat
  outputCompression?: number
  moderation?: ImageModeration
  user?: string
  writeGridTxt?: boolean
  writeCellTxt?: boolean
  cropPaddingFraction?: number
}

export type ImageGridGenerateSingleResult = {
  gridPath: string
  cellPaths: string[]
}

export async function imageGridGenerateSingle(
  options: ImageGridGenerateSingleOptions,
): Promise<Result<ImageGridGenerateSingleResult>> {
  const generateResult = await codexImageGenerate({
    client: options.client,
    prompt: options.prompt,
    outputPath: options.gridOutputPath,
    size: options.size,
    model: options.model,
    quality: options.quality,
    background: options.background,
    outputFormat: options.outputFormat,
    outputCompression: options.outputCompression,
    moderation: options.moderation,
    user: options.user,
    writeTxt: options.writeGridTxt ?? false,
  })
  if (!generateResult.success) return generateResult

  const sliceResult = imageGridSliceSingle({
    gridPath: generateResult.data.outputPath,
    cols: options.cols,
    rows: options.rows,
    cells: options.cells,
    cropCellToAspect: options.cropCellToAspect,
    cropPaddingFraction: options.cropPaddingFraction,
    writeTxt: options.writeCellTxt ?? true,
  })
  if (!sliceResult.success) return sliceResult

  return createResult({ gridPath: generateResult.data.outputPath, cellPaths: sliceResult.data })
}
