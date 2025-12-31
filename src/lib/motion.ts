/**
 * Motion animation constants and variants for CDC-LIMS
 *
 * Design Philosophy: "Smooth & reassuring" feel appropriate for professional lab environment
 * - 150ms fast (micro-interactions)
 * - 250ms normal (most transitions)
 * - 350ms slow (emphasis, dialogs)
 */

// Timing presets (in seconds for Motion)
export const durations = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.35,
} as const

// Easing presets
export const easings = {
  // Standard easing curves (CSS cubic-bezier format)
  ease: [0.25, 0.1, 0.25, 1] as const,
  easeOut: [0, 0, 0.2, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  // Dialog-specific easing (snappy entrance, smooth exit)
  dialog: [0.16, 1, 0.3, 1] as const,
  // Spring physics for natural motion
  spring: { type: "spring" as const, stiffness: 300, damping: 25 },
  springGentle: { type: "spring" as const, stiffness: 200, damping: 20 },
}

// ============================================
// Reusable animation variants
// ============================================

/**
 * Simple fade in/out
 * Usage: <motion.div {...fadeIn} />
 */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const

/**
 * Fade in with subtle scale (90% → 100%)
 * Great for panels, cards, dialogs
 * Usage: <motion.div {...fadeInScale} transition={{ duration: durations.normal }} />
 */
export const fadeInScale = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
} as const

/**
 * Slide in from bottom with fade
 * Good for sheets, drawers, toasts
 */
export const slideInFromBottom = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
} as const

/**
 * Slide in from right with fade
 * Good for side sheets
 */
export const slideInFromRight = {
  initial: { opacity: 0, x: "100%" },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: "100%" },
} as const

// ============================================
// Component-specific presets
// ============================================

/**
 * Status badge pulse animation (scale 1 → 1.05 → 1)
 * Triggered when status changes
 */
export const statusBadgePulse = {
  scale: [1, 1.05, 1] as number[],
  transition: { duration: 0.3 },
}

/**
 * Table row highlight animation (yellow flash then fade)
 * Used when row data updates
 */
export const rowHighlight = {
  backgroundColor: ["rgb(254 249 195)", "transparent"] as string[],
  transition: { duration: 0.8, ease: "easeOut" as const },
}

/**
 * Dialog overlay animation
 */
export const dialogOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: durations.fast },
} as const

/**
 * Dialog content animation (scale + fade)
 */
export const dialogContent = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: durations.normal, ease: easings.dialog },
} as const

/**
 * Page transition (simple crossfade)
 * @deprecated Use View Transitions API instead (enabled in next.config.ts).
 * This was used with PageTransition component which caused infinite render loops.
 */
export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: durations.fast },
} as const

// ============================================
// Utility types
// ============================================

export type Duration = (typeof durations)[keyof typeof durations]
export type EasingPreset = keyof typeof easings
