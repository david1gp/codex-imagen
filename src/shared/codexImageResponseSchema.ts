import * as a from "valibot"

export const codexImageResponseSchema = a.object({
  created: a.optional(a.number()),
  data: a.array(
    a.object({
      b64_json: a.optional(a.string()),
      revised_prompt: a.optional(a.string()),
    }),
  ),
  usage: a.optional(a.unknown()),
})

export type CodexImageResponse = a.InferOutput<typeof codexImageResponseSchema>
