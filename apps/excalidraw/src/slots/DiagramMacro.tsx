import { Box, Button, Group, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import {
  StarhiveBridgeError,
  useAutoResize,
  useMacroState,
  useTheme,
  useToast,
} from '@starhive/bridge'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DARK_MODE_FILTER, diagramAltText, type DiagramState, readDiagramState } from '../diagram'
import type { DiagramController } from '../DiagramCanvas'
import { setExcalidrawAssetPath } from '../excalidrawAssets'
import { useFullscreen } from '../useFullscreen'

/**
 * The chunk boundary.
 *
 * The importer sets the font asset path *before* pulling the canvas in, which is the only ordering
 * that works: a static import inside `DiagramCanvas` is hoisted above any assignment in that module,
 * so the value has to be in place before the module is fetched at all. Keep the specifier a literal,
 * or the bundler stops splitting here and every reader downloads the editor.
 */
const DiagramCanvas = lazy(async () => {
  setExcalidrawAssetPath()
  const module = await import('../DiagramCanvas')
  return { default: module.DiagramCanvas }
})

/**
 * How tall the canvas stands when it could not take the screen.
 *
 * Only a fallback: editing normally goes fullscreen, because a strip of someone's document is no
 * place to draw. This is what a browser that refused gets.
 */
const FALLBACK_EDITOR_HEIGHT = 560

/**
 * How long to wait for the picture before giving up on it.
 *
 * Exporting loads fonts, and a font that can neither arrive nor fail leaves the promise pending for
 * ever — which is a Save button that does nothing at all, with no error anywhere. A save that cannot
 * finish has to say so.
 */
const EXPORT_TIMEOUT_MS = 15_000

/** Big enough to read as somewhere to click, small enough not to shove the page around. */
const EMPTY_STATE_HEIGHT = 140

/**
 * A diagram, as a block in someone's page.
 *
 * The drawing lives on the block itself — `macro.setState` writes it onto the document node — so a
 * diagram belongs to the page it was drawn in: copied with the page, restored with an old version of
 * it, and gone when the block is deleted. The app provisions nothing and stores nothing of its own.
 *
 * Reading costs no canvas. The stored SVG is self-contained, so a reader gets one `<img>` and the
 * editor is never fetched.
 */
export function DiagramMacro() {
  const { state, setState, isSaving, canSave } = useMacroState()
  const diagram = useMemo(() => readDiagramState(state), [state])

  const contentRef = useAutoResize<HTMLDivElement>()
  const toast = useToast()
  const { colorScheme } = useTheme()

  const [isEditing, setIsEditing] = useState(false)
  /** Whether the pointer is over the block, which is what reveals its controls. */
  const [isHovered, setIsHovered] = useState(false)
  /**
   * A failure the editor can show itself.
   *
   * `useToast` is drawn by the host, in the page behind this iframe — and while the editor has the
   * screen, the page behind it is not visible at all. A save that failed then reported nothing: a
   * spinner, and then the editor still open with no reason given.
   */
  const [saveError, setSaveError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const controllerRef = useRef<DiagramController | null>(null)
  const fullscreen = useFullscreen<HTMLDivElement>()

  /**
   * Leaving fullscreen leaves the editor.
   *
   * The user can exit with Escape or the browser's own control, without touching anything of ours -
   * and a drawing surface left sitting in the page afterwards, with the drawing still unsaved, reads
   * as a bug. Coming out together is what makes their exit and our Cancel mean the same thing.
   */
  useEffect(() => {
    if (isEditing && !fullscreen.isFullscreen) setIsEditing(false)
    // Only the leaving edge matters; entering is what `openEditor` just did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen.isFullscreen])

  /**
   * Opens the editor on what is currently saved.
   *
   * The description is seeded here rather than in an effect on purpose: an effect would have to
   * depend on the stored title, and would then overwrite what someone is halfway through typing if
   * the host pushed the block's state again mid-edit. Seeding once, on the way in, cannot.
   */
  const openEditor = () => {
    setSaveError(null)
    setTitle(diagram?.title ?? '')
    setIsEditing(true)
    // Within the click, so the browser still counts it as a user gesture.
    void fullscreen.enter()
  }

  const closeEditor = () => {
    setIsEditing(false)
    void fullscreen.exit()
  }

  // Stable, so the canvas' effect does not re-run and hand back a new controller on every render.
  const handleReady = useCallback((controller: DiagramController) => {
    controllerRef.current = controller
  }, [])

  const handleSave = async () => {
    const controller = controllerRef.current
    if (!controller) return

    /*
     * The export is inside the try, not before it.
     *
     * Rendering the picture can fail on its own — it rasterises fonts, reads the canvas, and runs
     * code the host's CSP has opinions about — and outside the try that surfaced as an unhandled
     * rejection: Save did nothing at all, with the reason only in the console. A save that fails
     * has to say so.
     */
    // Remembered for the failure message: "too large" is only useful with a number next to it.
    let payloadBytes: number | null = null
    setSaveError(null)
    /*
     * The save narrates itself.
     *
     * Every step here can fail in a way that looks identical from the outside — a spinner that never
     * stops — and they need different fixes: rendering the picture, the size of it, and the host
     * accepting it are three different problems. One line each turns "it does not save" into a
     * question with an answer.
     */
    const step = (message: string) => console.info(`[diagram] ${message}`)
    try {
      step('exporting the picture…')
      const drawn = await withTimeout(controller.export(), EXPORT_TIMEOUT_MS)
      step(`exported (${Math.round(drawn.imageDataUrl.length / 1024)} KB image)`)
      if (drawn.isEmpty) {
        await toast('Draw something before saving.', 'warning')
        return
      }

      const trimmed = title.trim()
      const next: DiagramState = {
        scene: drawn.sceneJson,
        image: drawn.imageDataUrl,
        // Omitted rather than stored empty, so "never described" and "described as nothing" are the
        // same thing to everything that reads it.
        ...(trimmed ? { title: trimmed } : {}),
      }

      payloadBytes = JSON.stringify(next).length
      step(`saving ${Math.round(payloadBytes / 1024)} KB onto the page…`)
      await setState({ ...next })
      step('saved')
      closeEditor()
    } catch (error) {
      const message = saveFailureMessage(error, payloadBytes)
      console.error('[diagram] save failed', error)
      // Shown in the editor, and sent to the host as well for the times the editor is not on top.
      setSaveError(message)
      await toast(message, 'error')
    }
  }

  return (
    // The measured element: its height is what the host gives the block.
    <div ref={contentRef} style={{ padding: '0.5rem 0' }}>
      {/*
       * The element that takes the screen — always mounted, which is the whole point.
       *
       * `requestFullscreen` has to be called inside the click that asked for it, and it needs a real
       * element. Putting the ref on the editor meant asking for an element that React had not
       * rendered yet: `setIsEditing(true)` only schedules a render, so at the moment of the click the
       * ref was still null and the request was silently skipped — the editor opened, at the width of
       * the document, exactly as if fullscreen had been refused.
       *
       * Fullscreen also paints over everything, so unlike the block — deliberately transparent, so
       * the page shows through — this needs a ground of its own once it has the screen.
       */}
      <div
        ref={fullscreen.ref}
        style={{
          height: fullscreen.isFullscreen ? '100vh' : undefined,
          padding: fullscreen.isFullscreen ? '1rem' : undefined,
          background: fullscreen.isFullscreen ? 'var(--mantine-color-body)' : undefined,
          boxSizing: 'border-box',
        }}
      >
        {isEditing ? (
          <Stack gap="xs" h="100%">
            <TextInput
              label="Description"
              description="What this diagram shows, for anyone using a screen reader."
              placeholder="How the parts fit together"
              size="xs"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
            {/* The canvas takes what is left of the screen, or a fixed height in the block. */}
            <Box
              style={{
                flex: fullscreen.isFullscreen ? 1 : undefined,
                minHeight: 0,
                height: fullscreen.isFullscreen ? undefined : FALLBACK_EDITOR_HEIGHT,
              }}
            >
              <Suspense fallback={<Centered>Loading the canvas…</Centered>}>
                <DiagramCanvas initialSceneJson={diagram?.scene} onReady={handleReady} />
              </Suspense>
            </Box>
            <Group justify="flex-end" gap="xs">
              <Button variant="default" size="xs" onClick={closeEditor}>
                Cancel
              </Button>
              <Button size="xs" loading={isSaving} onClick={() => void handleSave()}>
                Save
              </Button>
            </Group>
          </Stack>
        ) : diagram ? (
          /*
           * The picture, with its control floating over it.
           *
           * The block has to look the same whether the page is being read or written — a permanent
           * Edit row made it a line taller in the editor, so the same document moved as you switched
           * modes. The control now hangs over the foot of the picture and appears on hover, which is
           * where every other macro keeps its controls, and it takes no height at all.
           */
          <Box
            style={{ position: 'relative' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* One image, and no canvas library: this is the whole read path. */}
            <img
              src={diagram.image}
              alt={diagramAltText(diagram)}
              style={{
                width: '100%',
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
                // The drawing is stored as drawn; a dark page shows it the way the editor's dark mode
                // would. Without this a diagram in dark ink sits invisible on a dark background.
                filter: colorScheme === 'dark' ? DARK_MODE_FILTER : undefined,
                cursor: canSave ? 'pointer' : 'default',
              }}
              // A reader has nothing to open: saving would be refused, so the picture is just a
              // picture.
              onDoubleClick={canSave ? openEditor : undefined}
            />
            {canSave && (
              <Box
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  // Hidden rather than transparent: an invisible bar that still caught the pointer
                  // would swallow a double-click meant for the picture underneath it.
                  visibility: isHovered ? 'visible' : 'hidden',
                }}
              >
                {/*
                 * `default`, not `subtle`.
                 *
                 * A subtle button is transparent, and this one floats over a picture — one that a
                 * dark page renders through an inverting filter, so whatever is behind the label is
                 * not something the app can predict. `default` brings its own background, border and
                 * text colour, and those three are the ones the theme remaps for dark mode, so the
                 * button is legible in both schemes without this file naming a single colour.
                 */}
                <Button
                  variant="default"
                  size="compact-xs"
                  onClick={openEditor}
                  style={(theme) => ({ boxShadow: theme.shadows.sm })}
                >
                  Edit
                </Button>
              </Box>
            )}
          </Box>
        ) : /*
         * The empty block is one target, not a label with a button beside it.
         *
         * A block that has just been inserted has exactly one thing to do next, so the whole thing
         * does it — nobody should have to read a sentence and then find a small button. It stays a
         * real `button`, so it is reachable by keyboard and announced as one, and the click is what
         * lets the editor take the screen: the browser only grants fullscreen to a gesture, and the
         * `/` menu's click happened in the page, not in here, so it cannot be inherited.
         */
        canSave ? (
          <UnstyledButton
            onClick={openEditor}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="Draw a diagram"
            style={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: EMPTY_STATE_HEIGHT,
              border: `1px dashed ${isHovered ? theme.colors.primary[6] : theme.colors.neutral[3]}`,
              borderRadius: theme.radius.sm,
              backgroundColor: isHovered ? theme.colors.neutral[1] : 'transparent',
              transition: 'border-color 120ms ease, background-color 120ms ease',
            })}
          >
            <Stack align="center" gap={2}>
              <Text size="sm" fw={600}>
                Draw a diagram
              </Text>
              <Text size="xs" c="dimmed">
                Opens the editor full screen
              </Text>
            </Stack>
          </UnstyledButton>
        ) : (
          /*
           * A block nobody has drawn in, on a page being read.
           *
           * Still shown rather than hidden: the block is in the document, someone put it there, and
           * a reader who sees nothing at all would think the page was broken. It just does not
           * pretend to be a button — there is nothing behind it for them.
           */
          <Box
            p="sm"
            style={(theme) => ({
              border: `1px dashed ${theme.colors.neutral[3]}`,
              borderRadius: theme.radius.sm,
            })}
          >
            <Text size="sm" c="dimmed">
              No diagram has been drawn here yet.
            </Text>
          </Box>
        )}
      </div>
    </div>
  )
}

/** Rejects rather than hanging, so a stuck export becomes an error somebody can read. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'the drawing took too long to render — its fonts may not have loaded (see the console)',
            ),
          ),
        ms,
      ),
    ),
  ])
}

/**
 * What to tell someone whose diagram would not save.
 *
 * [payloadBytes] is null when the drawing never got as far as being measured, which is itself the
 * useful distinction: the export failed rather than the save being refused.
 */
function saveFailureMessage(error: unknown, payloadBytes: number | null): string {
  const code = error instanceof StarhiveBridgeError ? error.code : null
  switch (code) {
    case 'FORBIDDEN':
      // The page is being read, not written: there is no document transaction to save into.
      return 'A diagram can only be saved while the page is being edited.'
    case 'BAD_REQUEST':
      // With the size, because "too large" on its own leaves someone guessing how much to cut.
      return `This drawing is too large to store in the page${
        payloadBytes ? ` (${Math.round(payloadBytes / 1024)} KB)` : ''
      }. Try simplifying it.`
    case 'UNKNOWN_METHOD':
      // An older host that predates per-block state — worth naming, because nothing the person does
      // to the drawing will help.
      return 'This version of Starhive cannot store a diagram in a page yet.'
    default:
      break
  }
  if (payloadBytes === null) {
    // Never reached the save: the picture itself could not be produced.
    const detail = error instanceof Error ? error.message : ''
    return `The drawing could not be exported${detail ? `: ${detail}` : '.'}`
  }
  return `That diagram could not be saved${code ? ` (${code})` : ''}.`
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Group justify="center" align="center" h="100%" mih={80}>
      <Text size="sm" c="dimmed">
        {children}
      </Text>
    </Group>
  )
}
