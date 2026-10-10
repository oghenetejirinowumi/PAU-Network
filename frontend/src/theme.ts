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
  /**
   * Brand rule: ONE main colour, #0033CC, used with plenty of white.
   * Every other colour is a lighter tint or darker shade of it, except the industry-standard
   * status colours (success green, warning amber, danger red), which are kept for meaning.
   *
   * Scale of #0033CC used below (tint = mixed with white, shade = mixed with black):
   *   tint 96% #F5F7FD · 92% #EBEFFB · 90% #E6EBFA · 88% #E0E7F9 · 85% #D9E0F7 · 65% #A6B8ED
   *   tint 50% #8099E6 · 25% #4066D9 · MAIN #0033CC · shade 80% #0029A3 · 75% #002699
   *   shade 55% #001C70 · 40% #001452 · 30% #000F3D
   */
  colors: {
    // Brand
    primary: "#0033CC", // main colour
    primaryHover: "#0029A3",
    primarySoft: "#E6EBFA", // tinted backgrounds, selected chips
    onPrimary: "#FFFFFF",
    accent: "#A6B8ED", // light tint: highlights on blue, secondary buttons
    accentHover: "#8099E6",
    accentSoft: "#D9E0F7",
    onAccent: "#001C70", // dark shade text on accent backgrounds

    // Surfaces and text
    background: "#F5F7FD",
    surface: "#FFFFFF",
    surfaceMuted: "#EBEFFB",
    ink: "#000F3D", // main text (darkest shade)
    muted: "#4066D9", // secondary text (5.1:1 on white, passes WCAG AA)
    line: "#E0E7F9", // borders and dividers

    // Status (industry-standard, the only non-blue colours)
    success: "#15803D",
    successSoft: "#E7F6EC",
    warning: "#B45309",
    warningSoft: "#FEF3E2",
    danger: "#B91C1C",
    dangerSoft: "#FDECEC",
    live: "#DC2626", // "LIVE" indicator on spaces

    // Membership tiers: deliberately distinct colours so medals and badges read as different levels.
    tierBronze: "#B45309",
    tierSilver: "#94A3B8",
    tierGold: "#F59E0B",
    tierPlatinum: "#6D28D9",
  },

  /** Default profile backdrop when a user has not uploaded a banner. */
  bannerGradient: "linear-gradient(120deg, #001452 0%, #0033CC 55%, #A6B8ED 120%)",

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
