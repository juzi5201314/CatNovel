export const designTokens = {
  colors: {
    canvas: "#ffffff",
    text: "#171717",
    mutedText: "#4d4d4d",
    line: "#ebebeb",
    surface: "#ffffff",
    surfaceMuted: "#fafafa",
    accentBlue: "#0a72ef",
    accentPink: "#de1d8d",
    accentRed: "#ff5b4f",
    focus: "hsla(212, 100%, 48%, 1)",
  },
  shadows: {
    ring: "0 0 0 1px rgba(0, 0, 0, 0.08)",
    lightRing: "0 0 0 1px rgb(235, 235, 235)",
    card:
      "0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 2px rgba(0, 0, 0, 0.04), 0 8px 8px -8px rgba(0, 0, 0, 0.04), 0 0 0 1px #fafafa inset",
    focus: "0 0 0 2px hsla(212, 100%, 48%, 1)",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    pill: "9999px",
  },
  spacing: [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 32, 36, 40],
} as const;
