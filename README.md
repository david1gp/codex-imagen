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
- `src/generate_grid_single`: single-request packed grid planning, generation, and slicing helpers.
- `src/generate_grid_multiple`: multi-request grid planning/generation helpers that preserve minimum cell resolution.
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

Library callers still supply client configuration directly; library workflows do not load environment variables or key files.

## CLI

Install the package, then invoke the executable with `bunx` (or install it globally and use `codex-imagen` directly):

```sh
bun add @adaptive-ds/codex-imagen
bunx codex-imagen --help
```

The CLI exposes only `generate` and `edit`. It reads these credentials:

```dotenv
CODEX_IMAGE_BASE_URL=https://your-image-endpoint.example
CODEX_IMAGE_API_KEY=your-api-key
```

By default it loads `.env` from the current working directory. A missing default `.env` is allowed, and existing environment variables take precedence over values loaded from it. Use `--dotenv-path PATH` to require a specific dotenv file.

Common flags:

| Flag | Values | Default |
| --- | --- | --- |
| `--dotenv-path` | Dotenv file path | `.env` in the current working directory; missing file allowed |
| `--request-timeout-ms` | Positive integer milliseconds | `300000` |
| `--help` | — | — |

### `generate`

```sh
bunx codex-imagen generate \
  --prompt "A clear glass orb on a blue background" \
  --output-path ./out/orb.png
```

Required flags: `--prompt`, `--output-path`.

| Flag | Values | Default |
| --- | --- | --- |
| `--model` | `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini` | `gpt-image-2` |
| `--size` | `auto` or `WxH` | `2048x1152` |
| `--quality` | `low`, `medium`, `high`, `auto` | `auto` |
| `--background` | `transparent`, `opaque`, `auto` | `auto` |
| `--output-format` | `png`, `jpeg`, `webp` | `png` |
| `--output-compression` | Integer `0`–`100` | `100` |
| `--moderation` | `auto`, `low` | `auto` |
| `--user` | String | — |
| `--write-txt` | Boolean; use `--write-txt=false` to disable | `true` |

### `edit`

```sh
bunx codex-imagen edit \
  --input-image-path ./in/source.png \
  --prompt "Replace the background with a sunset" \
  --output-path ./out/edited.png \
  --mask-path ./in/mask.png \
  --input-fidelity high
```

Required flags: `--input-image-path`, `--prompt`, `--output-path`.

Edit-only flags are `--mask-path` (optional path, omitted by default) and `--input-fidelity` (`low` or `high`, omitted by default). Edit also accepts the `generate` flags above, with these defaults: `--size 1536x1024`; all other shared image-option defaults are unchanged.

Successful commands print the output image path to stdout; failures use a nonzero exit status and stderr.
