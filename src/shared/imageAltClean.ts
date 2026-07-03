export function imageAltClean(text: string): string {
  return text
    .replace(/\b(generate|create|make|render|draw|paint|compose|design)\b/gi, "")
    .replace(/\b(image|picture|icon|asset|artwork|illustration)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}
