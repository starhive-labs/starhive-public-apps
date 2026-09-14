import { ActionIcon, Tooltip } from '@mantine/core'
import { useToast } from '@starhive/bridge'

/**
 * The copy affordance that lives inside the field it copies.
 *
 * A button beside the input said "Copy name" and looked like a decision; an icon in the field says
 * "take this", which is what it is. Feedback goes through `toast`, so it arrives as the same banner
 * Starhive shows when you copy a link to an object — an app that invents its own way of saying
 * "copied" is a second system talking.
 */
/**
 * Put text on the clipboard from inside an app frame.
 *
 * `navigator.clipboard` is gated by Permissions Policy, and a cross-origin iframe is denied unless
 * the host delegates `clipboard-write` — which Starhive now does, but an app cannot assume the host
 * it is running in is that new. So the modern API is tried first and the old selection trick catches
 * what it drops: `execCommand('copy')` is deprecated and gloriously unfashionable, but it is not
 * gated by any policy, works in every browser this runs in, and is the difference between a copy
 * button that works everywhere and one that works after an upgrade.
 *
 * Both need the user gesture this is called from, so neither can copy anything behind someone's back.
 */
async function write(value: string): Promise<boolean> {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    // Denied, or no clipboard at all. Fall through.
  }

  const holder = document.createElement('textarea')
  holder.value = value
  holder.setAttribute('readonly', '')
  // Off-screen but focusable: `display: none` cannot be selected, and a visible flash would be worse
  // than the copy failing.
  holder.style.position = 'fixed'
  holder.style.top = '-1000px'
  holder.style.opacity = '0'
  document.body.appendChild(holder)
  try {
    holder.select()
    holder.setSelectionRange(0, value.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    holder.remove()
  }
}

export function CopyField({ value, what }: { value: string; what: string }) {
  const toast = useToast()

  async function copy() {
    if (await write(value)) {
      void toast(`${what} copied`, 'success')
    } else {
      // Worth saying: a silent failure leaves someone pasting the last thing they copied and
      // wondering why the branch name is wrong.
      void toast(`Could not copy the ${what.toLowerCase()}`, 'error')
    }
  }

  // Below, not beside. To the left the tooltip sat squarely on top of the value it offers to copy,
  // hiding the one thing someone is looking at while they decide whether to press it.
  return (
    <Tooltip label={`Copy ${what.toLowerCase()}`} withArrow position="bottom">
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        onClick={copy}
        disabled={!value}
        aria-label={`Copy ${what.toLowerCase()}`}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none">
          <rect x="5.6" y="5.6" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M10.4 3.4a1.6 1.6 0 0 0-1.6-1.6H4a1.6 1.6 0 0 0-1.6 1.6v4.8a1.6 1.6 0 0 0 1.6 1.6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </ActionIcon>
    </Tooltip>
  )
}
