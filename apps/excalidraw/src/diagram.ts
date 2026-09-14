/**
 * What a diagram block remembers.
 *
 * Both halves are stored: the scene so the drawing can be edited again, and the SVG so a reader needs
 * nothing but an `<img>`. Storing only the scene would mean loading the canvas library — about a
 * megabyte — to look at a picture.
 */
export type DiagramState = {
  /** The Excalidraw scene, JSON. What the editor re-opens; never rendered. */
  scene: string
  /**
   * The rendered picture, as a PNG `data:` URL.
   *
   * A PNG rather than an SVG because an app bundle is served under a CSP that forbids both the
   * `new Function` its font subsetter needs and the CDN its font loader falls back to — an SVG
   * export waits on fonts that can never arrive. A raster of the canvas needs none of that.
   */
  image: string
  /**
   * What the diagram shows, in words — the picture's alt text.
   *
   * A diagram is the one kind of content that says nothing at all to a screen reader without this:
   * the SVG is shapes and the labels inside it are not a description of the whole. Optional, because
   * a drawing nobody has described is still better in the page than not there, and blank on every
   * diagram written before this field existed.
   */
  title?: string
}

/**
 * Read a block's stored state defensively.
 *
 * This comes back from the document, which can hold anything by the time it is read again — an older
 * version of this app wrote it, or a page was edited by hand. A block with unreadable state is an
 * empty block, not a broken one.
 */
export function readDiagramState(raw: Record<string, unknown> | undefined): DiagramState | null {
  const scene = typeof raw?.scene === 'string' ? raw.scene : ''
  const image = typeof raw?.image === 'string' ? raw.image : ''
  if (!scene || !image) return null
  const title = typeof raw?.title === 'string' ? raw.title.trim() : ''
  return { scene, image, ...(title ? { title } : {}) }
}

/**
 * What to put in the picture's `alt`.
 *
 * Never empty: an `alt=""` marks an image as decorative, and a diagram in someone's page is the
 * opposite of that — a reader who cannot see it should at least be told a diagram is there.
 */
export function diagramAltText(diagram: DiagramState): string {
  return diagram.title || 'Diagram'
}

/**
 * How a light-drawn diagram is shown on a dark page.
 *
 * Excalidraw's own value, used by the editor for its dark canvas — so a diagram on a dark page looks
 * exactly as it does in the editor's dark mode, rather than like an inversion someone invented. The
 * alternative was storing two SVGs, which doubles what the page carries to say the same thing twice.
 */
export const DARK_MODE_FILTER = 'invert(93%) hue-rotate(180deg)'
