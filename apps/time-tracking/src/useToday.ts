import { useEffect, useState } from 'react'

import { localDateIso } from './timeEntry'

/** How often the day is re-checked while the frame is in front. */
const CHECK_MS = 60_000

/**
 * Today's local calendar day, as `YYYY-MM-DD`, kept current while the frame stays open.
 *
 * Every period this app offers is reckoned from "now", and "now" used to be whatever it was when the
 * component mounted. That is fine for a panel somebody opens and closes, and wrong for the two
 * places an app frame is long-lived: a dashboard widget captioned "this month" still querying
 * September on the 2nd of October, and a page left open over a weekend still showing last week.
 *
 * Returned as a string rather than a `Date` so that it is stable by value: a component can put it
 * straight into a `useMemo` dependency list and recompute exactly once a day, rather than on every
 * render. Pair it with `dateFromIso`, which builds the local midnight a bare `new Date(iso)` would
 * get wrong.
 *
 * The interval alone is not enough. Browsers throttle timers hard in a tab that is not in front —
 * Chrome to roughly once a minute, and far less for a backgrounded window — so the day is also
 * re-checked when the page becomes visible and when the window regains focus. The focus listener is
 * the one that matters: a window merely sitting behind another is often never `hidden`, just slowed.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateIso(new Date()))

  useEffect(() => {
    // Only a real change is reported, so a check that finds the same day re-renders nothing.
    const check = () =>
      setToday((current) => {
        const now = localDateIso(new Date())
        return now === current ? current : now
      })

    const timer = setInterval(check, CHECK_MS)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
