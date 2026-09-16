/**
 * Plain text out of a TipTap document, for the RICH_TEXT fallback.
 *
 * The full renderer needs TipTap, a syntax highlighter, a router and mention enrichment, so it stays
 * a `renderRichText` slot. This is what a caller gets without one: readable, truncatable, and never
 * a blank cell.
 *
 * **A mention's visible text lives in `attrs.label`, not in a text node.** A naive walk over `text`
 * nodes silently drops every @mention in the document — the paragraph reads as though the person was
 * never named. The same trap is documented for the backend's `TipTapUtil`.
 */

type TipTapNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
}

/** Node types that end a line, so extracted text does not run words together across blocks. */
const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'codeBlock',
  'tableRow',
  'taskItem',
])

function isNode(value: unknown): value is TipTapNode {
  return typeof value === 'object' && value !== null
}

function walk(node: TipTapNode, out: string[]): void {
  if (typeof node.text === 'string') out.push(node.text)

  // A mention (and anything else labelled) carries its visible text on attrs, not as a child.
  const label = node.attrs?.['label']
  if (typeof label === 'string' && label) out.push(node.type === 'mention' ? `@${label}` : label)

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (isNode(child)) walk(child, out)
    }
  }

  if (node.type && BLOCK_TYPES.has(node.type)) out.push('\n')
}

/**
 * Extract the text of a TipTap document held as a JSON string.
 *
 * A value that is not TipTap JSON is returned as-is: a RICH_TEXT attribute can hold whatever was
 * written into it before the editor existed, and plain text is a perfectly good answer.
 */
export function richTextToPlainText(value: string): string {
  if (!value) return ''

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return value
  }
  if (!isNode(parsed)) return value

  const parts: string[] = []
  walk(parsed, parts)

  return parts
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
