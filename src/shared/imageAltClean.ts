const INSTRUCTION_PREFIX =
  /^\s*(please\s+)?(generate|create|make|produce|draw|render|design|illustrate|paint|sketch|show|place|put|composite)[a-z]*\s+(me\s+)?(an?|the|this)?\s*(image|picture|photo|photograph|illustration|drawing|render|rendering|banner|logo|graphic|artwork|scene)?\s*(of|showing|depicting|that\s+shows?|with|on|:|,|-)?\s*/i

export function imageAltClean(prompt: string): string {
  const stripped = prompt.replace(INSTRUCTION_PREFIX, "").replace(/^\s+/, "")
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}
