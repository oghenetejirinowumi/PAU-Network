/**
 * PAU Network theme — the ONLY place colours are defined.
 *
 * Change a value here and the whole app updates: every component uses Tailwind classes such as
 * `bg-primary`, `text-muted`, `border-line`, which read the CSS variables generated from this file
 * (see `themeToCss` below and the `@theme inline` block in app/globals.css).
 *
 * Adding a NEW colour: add it here, then add one line to `@theme inline` in globals.css
 * (`--color-<name>: var(--<name>);`) to get `bg-<name>`, `text-<name>`, `border-<name>` classes.
 */
export const theme = {
  colors: {
    // Brand
    primary: "#1B0F5C", // deep indigo, from the hackathon deck
    primaryHover: "#2B1B87",
    primarySoft: "#ECE9FB", // tinted backgrounds, selected chips
    onPrimary: "#FFFFFF",
    accent: "#F5A623", // amber highlight
    accentHover: "#E0941A",
    accentSoft: "#FFF4DF",
    onAccent: "#1B0F5C",

    // Surfaces and text
    background: "#F6F5FB",
    surface: "#FFFFFF",
    surfaceMuted: "#F1EFF8",
    ink: "#15122B", // main text
    muted: "#6B6785", // secondary text
    line: "#E5E2EF", // borders and dividers

    // Status
    success: "#15803D",
    successSoft: "#E7F6EC",
    warning: "#B45309",
    warningSoft: "#FEF3E2",
    danger: "#B91C1C",
    dangerSoft: "#FDECEC",
    live: "#E11D48", // "LIVE" badges on spaces

    // Membership tiers (badges, rings, leaderboard)
    tierBronze: "#B4703E",
    tierSilver: "#8A93A6",
    tierGold: "#D69E12",
    tierPlatinum: "#5B6CF0",
  },

  /** Default profile backdrop when a user has not uploaded a banner. */
  bannerGradient: "linear-gradient(120deg, #1B0F5C 0%, #3A2A9E 55%, #F5A623 130%)",

  radius: {
    card: "16px",
    control: "10px",
  },
} as const;

export type ThemeColor = keyof typeof theme.colors;

const toKebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Turns the theme into `:root { --primary: …; … }`, injected once in the root layout. */
export function themeToCss(): string {
  const colorVars = Object.entries(theme.colors).map(([name, value]) => `--${toKebab(name)}: ${value};`);
  return `:root{${[
    ...colorVars,
    `--banner-gradient: ${theme.bannerGradient};`,
    `--radius-card: ${theme.radius.card};`,
    `--radius-control: ${theme.radius.control};`,
  ].join("")}}`;
}
