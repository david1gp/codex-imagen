# Generate and edit CLI

## Goal

Add an `@stricli` executable for `codex-imagen generate` and `codex-imagen edit` while preserving the existing library API.

## Decisions

- Expose only `generate` and `edit`; do not expose grid commands.
- Resolve credentials from `CODEX_IMAGE_BASE_URL` and `CODEX_IMAGE_API_KEY`.
- Load `.env` by default and allow an explicit dotenv file through `--dotenv-path`.
- Expose every serializable option accepted by the two library workflows; keep custom `fetch` library-only.
- Use nonzero exits and stderr for failures; print successful output paths to stdout.
- Keep CLI code separate from library exports.

## Approach

- Add runtime dependencies for Stricli and dotenv plus a built CLI entrypoint.
- Implement shared option parsing, dotenv/client resolution, and result presentation once for both commands.
- Define command-specific inputs for generation and editing and delegate execution to the existing APIs.
- Cover argument mapping, dotenv selection, credential errors, success, and failure with Bun tests.
- Document installation, environment configuration, flags, and examples.

## Tasks

- [x] 1. Add dependencies, CLI package metadata, and the executable entrypoint.
- [x] 2. Implement shared CLI configuration, validation, and output behavior.
- [x] 3. Implement the `generate` command with all supported generation options.
- [x] 4. Implement the `edit` command with all supported edit options.
- [x] 5. Add focused CLI tests.
- [x] 6. Update README CLI documentation and verify build, tests, formatting, and executable help.

## Paths

- `package.json`
- `bun.lock`
- `src/cli.ts`
- `src/cli/`
- `src/generate_single/codexImageGenerate.ts`
- `src/edit/codexImageEdit.ts`
- `README.md`
