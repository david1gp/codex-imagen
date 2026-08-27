export const cliCommonFlags = {
  dotenvPath: {
    kind: "parsed" as const,
    parse: String,
    optional: true as const,
    brief: "Load environment variables from this dotenv file",
  },
  requestTimeoutMs: {
    kind: "parsed" as const,
    parse: Number,
    optional: true as const,
    brief: "Request timeout in milliseconds",
  },
}

export type CliCommonFlags = {
  dotenvPath?: string
  requestTimeoutMs?: number
}
