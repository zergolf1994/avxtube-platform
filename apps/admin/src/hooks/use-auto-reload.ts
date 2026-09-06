"use client"

import * as React from "react"

export function useAutoReload(callback: () => void, intervalMs: number) {
  const callbackRef = React.useRef(callback)
  callbackRef.current = callback

  React.useEffect(() => {
    if (intervalMs <= 0) return

    let lastReloadAt = Date.now()
    const reload = () => {
      if (document.visibilityState !== "visible") return
      lastReloadAt = Date.now()
      callbackRef.current()
    }
    const timer = window.setInterval(reload, intervalMs)
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastReloadAt >= intervalMs
      ) {
        reload()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [intervalMs])
}
