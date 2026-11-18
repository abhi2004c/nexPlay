// Descriptions from RAWG sometimes contain markdown headings ("###Setting The game is..."): make them readable.
export function cleanDescription(text, { multiline = true } = {}) {
  if (!text) return ''
  const t = text.replace(/#{2,}\s*/g, multiline ? '\n\n' : ' ').replace(/[ \t]+\n/g, '\n').trim()
  return t
}
