import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(${v} / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: rgb("11 74 110"),
        ink: rgb("23 28 33"),
        muted: rgb("94 102 112"),
        line: rgb("221 225 230"),
        canvas: rgb("245 246 248"),
        ok: rgb("22 120 70"),
        okbg: rgb("229 244 235"),
        warn: rgb("154 95 0"),
        warnbg: rgb("253 243 222"),
        danger: rgb("180 35 24"),
        dangerbg: rgb("252 232 230"),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        serif: ['"Source Serif 4"', "Georgia", "serif"],
      },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
};

export default config;
