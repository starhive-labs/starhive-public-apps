/**
 * Analysing a finished game.
 *
 * Every position it passed through, evaluated once, stored on the object. The first person to ask
 * pays for it — roughly twenty seconds for a forty-move game, behind a progress bar — and everyone
 * after reads the answer, including the same person on another device.
 *
 * It runs in the same worker the computer opponent uses, one position at a time, which is what makes
 * a progress count possible and keeps the board responsive while it works.
 */
import { useCallback, useRef, useState } from 'react'
import { Chess } from 'chess.js'

import { analysisMatches, parseEvals, serializeEvals } from '../chess/analysis'
import { type Game, replay } from '../chess/game'
import { ANALYSIS_ENGINE, ANALYSIS_PROFILE } from './levels'
import { useEngine } from './useEngine'

export type AnalysisState = {
  /** White-relative centipawns, one per position. Empty until analysed. */
  evals: number[]
  isRunning: boolean
  /** 0–100 while running. */
  progress: number
  error: Error | null
  /** Start it. Resolves with the evaluations, which the caller persists. */
  run: () => Promise<number[]>
}

/** The stored analysis for [game], if it has one that still describes it. */
export function storedAnalysis(game: Game | undefined): number[] {
  if (!game) return []
  const evals = parseEvals(game.evals)
  return analysisMatches(evals, game.moves.length) ? evals : []
}

export function useAnalysis(game: Game | undefined): AnalysisState {
  const engine = useEngine()
  const [evals, setEvals] = useState<number[]>([])
  const [isRunning, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const running = useRef(false)

  const run = useCallback(async () => {
    if (!game || running.current) return []
    running.current = true
    setRunning(true)
    setProgress(0)
    setError(null)
    try {
      const { fens } = replay(game)
      const scores: number[] = []
      for (const [index, fen] of fens.entries()) {
        const result = await engine.think(fen, ANALYSIS_PROFILE)
        // The engine scores from the mover's point of view; everything downstream is White-relative,
        // so black-to-move positions are flipped exactly once, here.
        const whiteRelative = new Chess(fen).turn() === 'w' ? result.score : -result.score
        scores.push(whiteRelative)
        setProgress(Math.round(((index + 1) / fens.length) * 100))
      }
      setEvals(scores)
      return scores
    } catch (failure) {
      setError(failure as Error)
      return []
    } finally {
      running.current = false
      setRunning(false)
    }
  }, [engine, game])

  return { evals, isRunning, progress, error, run }
}

export { ANALYSIS_ENGINE, ANALYSIS_PROFILE, serializeEvals }
