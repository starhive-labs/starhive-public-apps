/**
 * A move's annotation glyph — `?!`, `?`, `??`.
 *
 * Drawn rather than badged: these are chess notation, and a player reads them faster as a coloured
 * mark next to the move than as a pill with a word in it. The colours are fixed rather than themed,
 * for the same reason the evaluation bar's black and white are — a blunder is red in every chess
 * program anyone has used, in either colour scheme.
 */
import { Box } from '@mantine/core'

import { isFault, type Judgement, JUDGEMENT_COLOUR, JUDGEMENT_LABEL, JUDGEMENT_SYMBOL } from '../chess/analysis'

export function Annotation({ judgement, size = 18 }: { judgement: Judgement; size?: number }) {
  if (!isFault(judgement)) return null
  return (
    <Box
      component="span"
      title={JUDGEMENT_LABEL[judgement]}
      aria-label={JUDGEMENT_LABEL[judgement]}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        minWidth: size,
        height: size,
        padding: '0 4px',
        borderRadius: size / 4,
        background: JUDGEMENT_COLOUR[judgement],
        color: '#fff',
        fontSize: size * 0.62,
        fontWeight: 700,
        // The glyphs are punctuation; without this they sit oddly high in the box.
        lineHeight: 1,
      }}
    >
      {JUDGEMENT_SYMBOL[judgement]}
    </Box>
  )
}
