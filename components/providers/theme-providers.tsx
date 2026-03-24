"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
  storageKey?: string
}

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

const getSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

const applyThemeClass = (
  resolvedTheme: "light" | "dark",
  disableTransitionOnChange: boolean
) => {
  const root = document.documentElement

  let styleEl: HTMLStyleElement | null = null
  if (disableTransitionOnChange) {
    styleEl = document.createElement("style")
    styleEl.appendChild(
      document.createTextNode("*,*::before,*::after{transition:none!important}")
    )
    document.head.appendChild(styleEl)
  }

  root.classList.remove("light", "dark")
  root.classList.add(resolvedTheme)

  if (styleEl) {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      styleEl?.remove()
    })
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  storageKey = "theme",
  ...props
}: ThemeProviderProps) {
  void props

  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem(storageKey) as Theme | null
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      setThemeState(storedTheme)
      return
    }

    setThemeState(defaultTheme)
  }, [defaultTheme, storageKey])

  React.useEffect(() => {
    const effectiveTheme =
      theme === "system" && enableSystem ? getSystemTheme() : (theme as "light" | "dark")

    setResolvedTheme(effectiveTheme)
    applyThemeClass(effectiveTheme, disableTransitionOnChange)

    if (theme === "system") {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, theme)
    }
  }, [theme, enableSystem, disableTransitionOnChange, storageKey])

  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const systemTheme = getSystemTheme()
      setResolvedTheme(systemTheme)
      applyThemeClass(systemTheme, disableTransitionOnChange)
    }

    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme, enableSystem, disableTransitionOnChange])

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setThemeState,
    }),
    [theme, resolvedTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}