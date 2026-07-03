import { createResult, type Result } from "#result"
import { codexImageGenerate } from "../generate_single/codexImageGenerate.js"
import type { CodexImagenClientInput } from "../shared/codexImagenClient.js"
import type { ImageBackground } from "../shared/imageBackground.js"
import type { ImageModel } from "../shared/imageModel.js"
import type { ImageModeration } from "../shared/imageModeration.js"
import type { ImageOutputFormat } from "../shared/imageOutputFormat.js"
import type { ImageQuality } from "../shared/imageQuality.js"
import { type ImageGridCell, imageGridSlice } from "./imageGridSlice.js"

export type ImageGridGenerateOptions = {
  client: CodexImagenClientInput
  prompt: string
  gridOutputPath: string
  cells: ImageGridCell[]
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
}

export type ImageGridGenerateResult = {
  gridPath: string
  cellPaths: string[]
}

export async function imageGridGenerate(options: ImageGridGenerateOptions): Promise<Result<ImageGridGenerateResult>> {
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

  const sliceResult = imageGridSlice({
    gridPath: generateResult.data.outputPath,
    cols: options.cols,
    rows: options.rows,
    cells: options.cells,
    cropCellToAspect: options.cropCellToAspect,
    writeTxt: options.writeCellTxt ?? true,
  })
  if (!sliceResult.success) return sliceResult

  return createResult({ gridPath: generateResult.data.outputPath, cellPaths: sliceResult.data })
}
