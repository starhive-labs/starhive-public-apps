import '@excalidraw/excalidraw/index.css'

import { Excalidraw, exportToBlob, restore, serializeAsJSON } from '@excalidraw/excalidraw'
import type { ImportedDataState } from '@excalidraw/excalidraw/data/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useTheme } from '@starhive/bridge'
import { useCallback, useEffect, useRef } from 'react'

/**
 * The only module in the app that imports Excalidraw.
 *
 * It is reached exclusively through `DiagramMacro`'s dynamic import, which is what keeps the canvas —
 * about a megabyte — out of the bundle a reader loads. A macro block is read far more often than it
 * is drawn, and a reader only ever needs the `<img>`. Importing this file eagerly from anywhere would
 * undo that, and would also break the font asset path, which must be set before the library loads.
 */

/** What one export of the canvas produced. */
export type DiagramExport = {
  /** The Excalidraw scene, JSON. What the editor re-opens. */
  sceneJson: string
  /** The picture, as a PNG data URL. */
  imageDataUrl: string
  /** Whether the canvas holds anything at all, so an empty diagram is never saved. */
  isEmpty: boolean
}

/** The handle the block keeps, so Save can live outside the canvas and the imports stay here. */
export type DiagramController = {
  export: () => Promise<DiagramExport>
}

export type DiagramCanvasProps = {
  /** A previously saved scene; absent or null for a blank canvas. */
  initialSceneJson?: string | null
  onReady: (controller: DiagramController) => void
}

/** Air around the drawing, so strokes are not clipped at the edge of the exported picture. */
const EXPORT_PADDING = 16

/**
 * The longest edge the stored picture may have.
 *
 * The picture lives in the page body, which is fetched whole every time anyone reads that page, and
 * a raster grows with its area — an unbounded canvas would eventually produce a block too big to
 * store and a page slow to load. Wide enough to stay crisp on a normal screen, and it only shrinks
 * the drawings that had run away.
 */
const EXPORT_MAX_EDGE = 2400

/**
 * How long after mounting to keep watching for the canvas settling into place.
 *
 * Long enough to outlast the block growing into edit mode, with room to spare; it costs a handful of
 * `getBoundingClientRect` reads at mount and nothing after that.
 */
const SETTLE_WATCH_MS = 800

export function DiagramCanvas({ initialSceneJson, onReady }: DiagramCanvasProps) {
  const { colorScheme } = useTheme()
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<{ top: number; left: number } | null>(null)

  /**
   * Tells Excalidraw where its container is, if it has moved since it last looked.
   *
   * Excalidraw turns a pointer position into a scene coordinate by subtracting its container's
   * position, which it reads once on mount and then re-reads only when the container's *size*
   * changes — a `ResizeObserver` does not fire for an element that merely moves. In a macro the block
   * grows when editing starts and the page reflows around it, so the canvas can easily mount at one
   * offset and end up at another; every click then lands that far out for the rest of the session.
   * `refresh()` is the library's own way to say "look again".
   */
  const refreshOffsetsIfMoved = useCallback(() => {
    const api = apiRef.current
    const wrapper = wrapperRef.current
    if (!api || !wrapper) return
    const { top, left } = wrapper.getBoundingClientRect()
    const previous = originRef.current
    if (previous && previous.top === top && previous.left === left) return
    originRef.current = { top, left }
    api.refresh()
  }, [])

  /** While the block is growing into edit mode, follow the canvas until it stops moving. */
  useEffect(() => {
    let frame = 0
    const until = performance.now() + SETTLE_WATCH_MS
    const tick = () => {
      refreshOffsetsIfMoved()
      if (performance.now() < until) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [refreshOffsetsIfMoved])

  /**
   * Anything that moves the canvas later — the page scrolling behind the iframe, a block above this
   * one growing — is caught as the pointer arrives, before the click it would send astray. On entry
   * rather than on every move: this reads layout, and doing that per `pointermove` would force a
   * reflow in the middle of drawing.
   */
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    wrapper.addEventListener('pointerenter', refreshOffsetsIfMoved)
    return () => wrapper.removeEventListener('pointerenter', refreshOffsetsIfMoved)
  }, [refreshOffsetsIfMoved])

  const exportScene = useCallback(async () => {
    const api = apiRef.current
    if (!api) throw new Error('The canvas is not ready yet')

    // Deleted elements stay in the scene as tombstones; neither the picture nor "is it empty"
    // should count them.
    const elements = api.getSceneElements()
    const appState = api.getAppState()
    const files = api.getFiles()

    /*
     * PNG, not SVG.
     *
     * An SVG export embeds the fonts it used, which means subsetting them — and subsetting runs
     * `new Function`, which the CSP an app bundle is served under forbids (`script-src 'self'
     * 'unsafe-inline'`). Excalidraw survives that by embedding whole fonts instead, but it still has
     * to *fetch* them, and a font the CSP blocks never arrives and never fails: the export waits for
     * ever and Save does nothing at all.
     *
     * A PNG is rasterised from the canvas that is already on screen. No fonts to embed, nothing to
     * subset, nothing to fetch — it cannot hang, and it shows exactly what was drawn. The scene is
     * still stored beside it, so the drawing itself stays editable and loses nothing.
     */
    const blob = await exportToBlob({
      elements,
      appState: {
        ...appState,
        // The picture is read in someone's page, not in this editor: the canvas' own background and
        // dark mode are the editor's business. Kept transparent so it sits on the page, and shown on
        // a dark page through Excalidraw's own dark filter — see `DARK_MODE_FILTER`.
        exportBackground: false,
        exportWithDarkMode: false,
      },
      files,
      exportPadding: EXPORT_PADDING,
      mimeType: 'image/png',
      maxWidthOrHeight: EXPORT_MAX_EDGE,
    })

    return {
      sceneJson: serializeAsJSON(elements, appState, files, 'local'),
      imageDataUrl: await blobToDataUrl(blob),
      isEmpty: elements.length === 0,
    }
  }, [])

  useEffect(() => {
    onReady({ export: exportScene })
  }, [exportScene, onReady])

  /*
   * Excalidraw fills its containing block, which must therefore have a height of its own — in normal
   * flow a plain div collapses to nothing and the canvas never appears.
   */
  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api
        }}
        // The host's scheme, not the browser's: the block sits in a Starhive page and a light editor
        // punched into a dark one is the thing people notice first.
        theme={colorScheme}
        /*
         * `restore` rather than the parsed JSON straight from the attribute: it migrates a scene
         * written by an older Excalidraw and repairs arrow bindings, which is exactly what re-opening
         * a stored diagram is. Feeding it raw would work today and break on the first version bump.
         */
        initialData={
          initialSceneJson
            ? restore(JSON.parse(initialSceneJson) as ImportedDataState, null, null)
            : { appState: { viewBackgroundColor: 'transparent' } }
        }
      />
    </div>
  )
}

/** A blob as a `data:` URL, which is what a document can carry and an `<img>` can read. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('the picture could not be read'))
    reader.readAsDataURL(blob)
  })
}
