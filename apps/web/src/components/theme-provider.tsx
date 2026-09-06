"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import NextTopLoader from "nextjs-toploader";

// Suppress the React 19 false positive warning for inline script tags injected by next-themes
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) return;
    orig.apply(console, args);
  };
}

function TopLoader() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // ใช้ค่า default ตอน SSR เพื่อหลีกเลี่ยง hydration mismatch
  const isDark = mounted ? resolvedTheme === "dark" : false
  const color = isDark ? "#f0f0f0" : "#0f0f0f"
  const shadow = isDark ? "0 0 10px #f0f0f0,0 0 5px #f0f0f0" : "0 0 10px #0f0f0f,0 0 5px #0f0f0f"

  return (
    <NextTopLoader
      color={color}
      initialPosition={0.08}
      crawlSpeed={200}
      height={4}
      crawl={true}
      showSpinner={false}
      easing="ease"
      speed={200}
      shadow={shadow}
    />
  )
}


function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <TopLoader />
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
