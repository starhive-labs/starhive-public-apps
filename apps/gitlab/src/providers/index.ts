import { gitlab } from './gitlab'
import type { CodeLocator, Provider } from './types'

/**
 * The one code host this app talks to.
 *
 * There is no registry any more. A registry existed so that a single app could hold GitLab and
 * GitHub rows apart and pick the right client per row; one app per product ended that, and every row
 * here came from GitLab by construction. The seam in `types.ts` stays, because it is what makes the
 * GitHub app a copy of this one with a single file changed.
 */
export const providers: Provider[] = [gitlab]

/** The provider that recognises this URL, with what it read out of it. */
export function locateUrl(url: string): { provider: Provider; locator: CodeLocator } | null {
  for (const provider of providers) {
    const locator = provider.locate(url)
    if (locator) return { provider, locator }
  }
  return null
}

export { gitlab }
export type {
  CodeLocator,
  CodeRefKind,
  CodeState,
  ProjectMergeRequest,
  Provider,
  SearchHit,
} from './types'
export { ProviderError } from './types'
