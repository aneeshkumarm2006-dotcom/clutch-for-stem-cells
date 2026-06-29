import type { Config } from "tailwindcss";

/**
 * Azure Clinical design tokens — Design §14.2.
 * Raw scales (azure/slate) build the semantic CSS-var layer in globals.css;
 * shadcn primitives reference the semantic vars, not these raw scales.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "16px", sm: "20px", lg: "32px" },
      screens: { "2xl": "1200px" },
    },
    extend: {
      colors: {
        // Raw scales
        azure: {
          50: "#F2F8FD",
          100: "#E2F0FB",
          200: "#C8E3F8",
          300: "#9BCBF1",
          400: "#5BAAE8",
          500: "#2090D8",
          600: "#0E80CC",
          700: "#0A5A92",
          800: "#08446F",
          900: "#0A2A44",
        },
        ink: "#0C2233",
        slate: {
          50: "#F4F9FC",
          100: "#EAF2F8",
          200: "#D8E8F4",
          300: "#B6C8D8",
          400: "#90AAC0",
          500: "#708BA1",
          600: "#5C7388",
          700: "#34495C",
          800: "#1C3142",
          900: "#0C2233",
        },
        star: "#F2A900",
        // Status
        success: { DEFAULT: "#0E9F6E", bg: "#E3F6EF", fg: "#07623F" },
        warning: { DEFAULT: "#D98E04", bg: "#FCF1DC", fg: "#8A5A00" },
        danger: { DEFAULT: "#DC4C4A", bg: "#FCEBEB", fg: "#97231F" },

        // Semantic tokens (wired to CSS vars in globals.css) for shadcn primitives
        background: "var(--background)",
        foreground: "var(--text-primary)",
        surface: { DEFAULT: "var(--surface)", alt: "var(--surface-alt)" },
        tint: "var(--tint)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        input: "var(--border)",
        ring: "var(--primary)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--surface)",
          foreground: "var(--text-primary)",
        },
        muted: {
          DEFAULT: "var(--surface-alt)",
          foreground: "var(--text-secondary)",
        },
        accent: {
          DEFAULT: "var(--tint)",
          foreground: "var(--text-link)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "var(--surface)",
          foreground: "var(--text-primary)",
        },
        popover: {
          DEFAULT: "var(--surface)",
          foreground: "var(--text-primary)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          link: "var(--text-link)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(12,34,51,.05)",
        sm: "0 1px 2px rgba(12,34,51,.05), 0 1px 3px rgba(12,34,51,.06)",
        card: "0 1px 2px rgba(12,34,51,.05), 0 8px 24px -16px rgba(12,34,51,.18)",
        md: "0 4px 12px -2px rgba(12,34,51,.10)",
        lg: "0 12px 32px -8px rgba(12,34,51,.16)",
        elevated: "0 8px 24px -10px rgba(14,128,204,.24)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.3s cubic-bezier(0.4,0,0.2,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
