import { Easing } from "react-native";

/**
 * Motion constitution — one physics for the whole app.
 *
 * Every Animated call imports from here. No locally-invented springs or
 * durations: a product feels premium when everything in it moves like it
 * weighs the same.
 *
 * - `spring`    — the standard arrival: cards, sheets, pills.
 * - `springPop` — celebration only (hearts, saves); deliberately bouncier.
 * - `fast`      — dismissals and fade-outs.
 * - `standard`  — arrivals and fade-ins.
 * - `entrance`  — first-appearance moments (a set of pins landing).
 */
export const motion = {
  spring: { damping: 22, stiffness: 280, mass: 0.9 },
  springPop: { friction: 4, tension: 140 },
  duration: {
    fast: 160,
    standard: 240,
    entrance: 340,
  },
  easing: {
    out: Easing.out(Easing.cubic),
    in: Easing.in(Easing.cubic),
  },
} as const;
