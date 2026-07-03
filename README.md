# @adaptive-ds/codex-imagen

Type-safe TypeScript helpers for codex-lb/OpenAI-compatible image generation.

## Scope

- Generate single images with caller-provided `baseUrl`, `apiKey`, timeout, and optional `fetch`.
- Edit existing images with MIME-aware multipart uploads.
- Validate image options at runtime with Valibot before network calls.
- Plan efficient packed image grids with gpt-image-2 size constraints.
- Slice generated grids into individual cell images with ImageMagick.
- Return `Result<T>` values instead of throwing from fallible exported functions.

## Source Layout

- `src/edit`: image edit endpoint helpers.
- `src/generate_single`: single image generation endpoint helpers.
- `src/generate_grid`: packed grid planning, generation, and slicing helpers.
- `src/shared`: common schemas, request validation, response writing, and image option utilities.

## Example

```ts
import { codexImageGenerate, imageGridPlan } from "@adaptive-ds/codex-imagen"

const planResult = imageGridPlan({
  cellAspect: 1,
  desiredCellShortEdgePx: 256,
  cellCount: 4,
})
if (!planResult.success) return planResult

const result = await codexImageGenerate({
  client: {
    baseUrl: process.env.CODEX_IMAGE_BASE_URL ?? "",
    apiKey: process.env.CODEX_IMAGE_API_KEY ?? "",
  },
  prompt: "four clear square app icons in a 2x2 grid",
  outputPath: "./out/grid.png",
  size: planResult.data.requestSize,
  background: "opaque",
})
```

Callers own secret/env/file resolution. This package does not read environment variables or key files.
