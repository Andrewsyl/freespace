import { Router } from "express";
import { env } from "../env.js";
import { getPlatformFeeSchedule } from "../lib/pricing.js";
import { getPriceSuggestionConfig } from "../lib/priceSuggestions.js";

const router = Router();

// Public, unauthenticated: lets the mobile app resolve which Stripe mode
// (test/live) to run in from the server at startup, instead of it being
// frozen into the build. Flip STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY on
// the server together to switch every installed app at once.
// `pricing` works the same way: clients compute display prices from this
// schedule, the server verifies against the same values — so a fee change is
// an env flip + restart, never an app release. (Clients holding a stale
// schedule get a 400 "price out of date" and must refetch.)
router.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || null,
    pricing: getPlatformFeeSchedule(),
    // Host price suggestions (advisory only — never part of booking math).
    priceSuggestions: getPriceSuggestionConfig(),
  });
});

export default router;
