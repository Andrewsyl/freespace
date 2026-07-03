import { Router } from "express";
import { env } from "../env.js";

const router = Router();

// Public, unauthenticated: lets the mobile app resolve which Stripe mode
// (test/live) to run in from the server at startup, instead of it being
// frozen into the build. Flip STRIPE_PUBLISHABLE_KEY + STRIPE_SECRET_KEY on
// the server together to switch every installed app at once.
router.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
  });
});

export default router;
