// Shared overlay behavior (OD modal-components.html §08): one open layer at a time,
// Escape closes the top one, focus moves in and returns to the opener, Tab stays
// inside, and the page stops scrolling under modal layers.
//
// A layer registers while its component is mounted, so parents open and close
// overlays with v-if. Gallery previews pass `enabled: false` and stay inert.

import type { Ref } from 'vue'
import { nextTick, onBeforeUnmount, onMounted } from 'vue'

export interface OverlayOptions {
  panel: Ref<HTMLElement | undefined>
  close: () => void
  /** Keep Tab inside the panel (viewer, sheet, popover, confirm) */
  trap?: boolean
  /** Stop the page from scrolling underneath */
  lockScroll?: boolean
  /** Opens above the current layer instead of closing it. Only the confirm dialog does this. */
  stacked?: boolean
  /** Where focus lands on open; defaults to the first focusable control */
  initialFocus?: () => HTMLElement | null | undefined
  /** Close on a pointerdown outside the panel (popover). The returned elements do not count as outside. */
  closeOnOutside?: () => (Element | null | undefined)[]
  /** False in gallery previews: no focus moves, no key handling, no scroll lock */
  enabled?: boolean
}

interface Layer {
  options: OverlayOptions
  returnTo: HTMLElement | null
  /** Closed because another layer replaced it: focus must not jump back */
  replaced: boolean
}

const stack: Layer[] = []
let listening = false

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function focusables(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement)
}

function onKeydown(e: KeyboardEvent) {
  const top = stack.at(-1)
  if (!top)
    return
  if (e.key === 'Escape') {
    e.preventDefault()
    top.options.close()
    return
  }
  const panel = top.options.panel.value
  if (e.key !== 'Tab' || !top.options.trap || !panel)
    return
  const list = focusables(panel)
  if (!list.length) {
    e.preventDefault()
    return
  }
  const first = list[0]!
  const last = list.at(-1)!
  const active = document.activeElement
  if (!panel.contains(active)) {
    e.preventDefault()
    first.focus()
  }
  else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  }
  else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

function onPointerdown(e: PointerEvent) {
  const top = stack.at(-1)
  const ignore = top?.options.closeOnOutside?.()
  if (!top || !ignore)
    return
  const target = e.target as Node
  if (top.options.panel.value?.contains(target) || ignore.some(el => el?.contains(target)))
    return
  top.options.close()
}

function syncScrollLock() {
  document.documentElement.style.overflow = stack.some(l => l.options.lockScroll) ? 'hidden' : ''
}

function listen() {
  if (listening)
    return
  listening = true
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerdown, true)
}

export function useOverlay(options: OverlayOptions) {
  let layer: Layer | undefined

  onMounted(() => {
    if (options.enabled === false)
      return
    listen()
    // Only one layer at a time; the confirm dialog is the one exception
    if (!options.stacked) {
      for (const other of stack.splice(0)) {
        other.replaced = true
        other.options.close()
      }
    }
    const active = document.activeElement
    layer = { options, returnTo: active instanceof HTMLElement ? active : null, replaced: false }
    stack.push(layer)
    syncScrollLock()
    nextTick(() => {
      const panel = options.panel.value
      const target = options.initialFocus?.() ?? (panel && focusables(panel)[0])
      target?.focus()
    })
  })

  onBeforeUnmount(() => {
    if (!layer)
      return
    const i = stack.indexOf(layer)
    if (i !== -1)
      stack.splice(i, 1)
    syncScrollLock()
    // Give focus back to the control that opened the layer
    if (!layer.replaced && layer.returnTo?.isConnected)
      layer.returnTo.focus()
  })
}
