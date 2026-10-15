// Viewer zoom: 100–400% in 50% steps from the buttons, any value in between by
// the wheel or a pinch. Back at 100% the pan resets.

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4
export const ZOOM_STEP = 0.5
/** Zoom factor per px of wheel travel; one mouse notch (~100px) is about ×1.2 */
const WHEEL_RATE = 0.0018

export interface ZoomState {
  zoom: number
  x: number
  y: number
}

export function setZoom(state: ZoomState, zoom: number): ZoomState {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  return z === MIN_ZOOM ? { zoom: z, x: 0, y: 0 } : { ...state, zoom: z }
}

/**
 * Zooms while keeping the image point under (cx, cy) in place. The point is measured
 * from the stage centre, where the unpanned image's centre (its transform origin) sits.
 */
export function zoomAt(state: ZoomState, zoom: number, cx: number, cy: number): ZoomState {
  const next = setZoom(state, zoom)
  if (next.zoom === MIN_ZOOM)
    return next
  const k = next.zoom / state.zoom
  return { zoom: next.zoom, x: cx - (cx - state.x) * k, y: cy - (cy - state.y) * k }
}

/** The zoom a wheel event asks for: scrolling up zooms in */
export const wheelZoom = (zoom: number, deltaY: number) => zoom * Math.exp(-deltaY * WHEEL_RATE)

/**
 * Keeps the image from being dragged off the stage: each edge can travel only as far
 * as the stage edge. `w`/`h` are the image's unscaled size, `boxW`/`boxH` the stage's.
 */
export function clampPan(state: ZoomState, w: number, h: number, boxW: number, boxH: number): ZoomState {
  const limitX = Math.max(0, (w * state.zoom - boxW) / 2)
  const limitY = Math.max(0, (h * state.zoom - boxH) / 2)
  const clamp = (v: number, limit: number) => Math.min(limit, Math.max(-limit, v))
  return { ...state, x: clamp(state.x, limitX), y: clamp(state.y, limitY) }
}

export const zoomLabel = (zoom: number) => `${Math.round(zoom * 100)}%`
