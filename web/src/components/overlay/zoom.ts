// Viewer zoom: 100–400% in 50% steps from the buttons, any value in between by
// pinch or Ctrl + wheel. Back at 100% the pan resets.

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4
export const ZOOM_STEP = 0.5

export interface ZoomState {
  zoom: number
  x: number
  y: number
}

export function setZoom(state: ZoomState, zoom: number): ZoomState {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  return z === MIN_ZOOM ? { zoom: z, x: 0, y: 0 } : { ...state, zoom: z }
}

export const zoomLabel = (zoom: number) => `${Math.round(zoom * 100)}%`
