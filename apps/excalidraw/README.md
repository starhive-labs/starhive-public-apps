# Excalidraw — diagrams in a page

Draw a diagram inside a Starhive page. The app is one **macro**: a block a writer inserts from the
editor's `/` menu, which renders the diagram and opens a canvas to edit it.

## How it works

The drawing lives on the block, in the page. When you save, the app calls `macro.setState` and the
host writes the value onto the macro's document node:

| Key     | Holds                                                                             |
| ------- | --------------------------------------------------------------------------------- |
| `scene` | The Excalidraw scene, JSON. What the editor re-opens; never rendered              |
| `svg`   | The rendered picture, as self-contained SVG. What readers see                     |
| `title` | What the diagram shows, in words — the picture's `alt`. Optional, absent if unset |

So a diagram belongs to the page it was drawn in — copied when the page is copied, restored when an
old version of the page is restored, gone when the block is deleted. The app provisions nothing in
the workspace and stores nothing of its own, which is why `manifest.yaml` has no `data:` block.

The macro declares **no params**, so inserting it puts a block straight into the page with no dialog
in the way. The block _is_ the diagram; two of them on a page are two drawings.

**Reading costs no canvas.** Excalidraw inlines the font subsets it used into the exported SVG, so a
reader gets one `<img>` and the editor is never fetched — about 148 KB gzipped for the block against
roughly a megabyte for the canvas, which loads only on _Draw_ or _Edit_.

### Dark mode

The picture is exported light and stored that way, because one SVG has to serve readers in both
schemes. On a dark page the block applies Excalidraw's own dark filter (`invert(93%)
hue-rotate(180deg)` — the value the editor uses for its dark canvas), so a diagram looks there as it
does in the editor's dark mode. Baking the dark rendering in at export would let whoever saved it
decide how everyone else sees it, and storing both would double what the page carries to say the
same thing twice.

### Full screen

Editing takes the screen through the Fullscreen API; the host serves app frames with
`allow="fullscreen"` so an iframe may ask. If it is refused — no delegation, or a browser that will
not — the canvas opens in the block instead at a fixed height. Smaller, not broken.

### Limits

State is capped host-side (`MACRO_STATE_MAX_BYTES`, 256 KB of JSON) because it travels inside the
page body, which is fetched whole on every read of that page. A detailed drawing with many text
labels can approach that; the app surfaces the refusal rather than losing the work silently.

A block on a page being **read** rather than edited has no node to write to, so saving is refused
there — the same as the built-in editor, where you must be editing the page to change what is in it.

## Using it

1. Install the app. It provisions nothing.
2. In a page, type `/` and pick **Diagram**. An empty block lands where the cursor was.
3. **Draw** opens the canvas **full screen** — a strip of a document is no place to draw. Escape or
   _Cancel_ leaves; **Save** puts the picture in the page. Afterwards the block renders the
   drawing, with **Edit** to change it (or double-click the picture).

The editor also takes a **Description** — what the diagram shows, in words. It is the picture's `alt`
text and nothing else draws it, because a diagram says nothing at all to a screen reader otherwise:
the SVG is shapes, and the labels inside it are not a description of the whole. A diagram without one
still renders, and falls back to "Diagram" rather than an empty `alt`, which would mark it decorative.

## Developing

```sh
npm install
npm run dev        # http://localhost:4500
npm run tscheck
npm run build      # → ./build
npm run deploy     # build + publish via the CLI
```

### Fonts

`scripts/copy-excalidraw-assets.mjs` (wired to `predev`/`prebuild`) copies Excalidraw's fonts into
`public/`, which Vite ships with the bundle; `src/excalidrawAssets.ts` points the library at them.

This is not optional tidying. With nothing self-hosted — or with one family missing — Excalidraw
fetches the face from `https://esm.sh/...` instead, putting a third-party request in a customer's
page. That is why every family is copied, CJK included: the faces are `unicode-range` subsets, so a
browser downloads a few kilobytes even though the directory is 16 MB.

The path has to be computed at runtime (`document.baseURI`) rather than written as a relative URL,
because a published bundle is served from a versioned sub-path and Excalidraw resolves a `./` path
against the origin instead of the document.

## Licensing

`@excalidraw/excalidraw` is MIT — no licence key, no watermark, no fee. The bundled fonts are
separately licensed (Excalifont, Virgil, Xiaolai and the rest are OFL 1.1, which permits bundling and
redistribution); the OFL asks that its notice travel with redistributed font files, and Excalidraw
ships none, so add them alongside `public/excalidraw-assets/` before this goes to customers.
