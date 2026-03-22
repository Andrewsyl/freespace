import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import {
  getAdminDashboardMetrics,
  listUsers,
  updateUserStatus,
  listListingsForAdmin,
  updateListingStatus,
  insertAuditLog,
  deleteUserAccount,
  listDuePayoutsForAllHosts,
  markPayoutProcessing,
  markPayoutTransferred,
  markPayoutPending,
  listBookingsForAdmin,
  getBookingForAdmin,
  updateBookingAsAdmin,
  listPaymentsForAdmin,
  listPayoutsForAdmin,
  listSupportTickets,
  updateSupportTicket,
  listAdminSettings,
  upsertAdminSetting,
  listEventLog,
} from "../lib/db.js";
import { stripe } from "../lib/stripe.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();
const adminReadLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 120,
  keyPrefix: "admin-read",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});
const adminWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 60,
  keyPrefix: "admin-write",
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? "unknown",
});

const userStatusSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["driver", "host", "admin"]).optional(),
  adminNote: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(200).optional(),
});

const adminDeleteSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(100).optional(),
});

const listListingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["approved", "pending", "rejected", "disabled"]).optional(),
});

const listBookingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().trim().min(3).max(32).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  listingId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

const updateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "canceled"]).optional(),
  refundId: z.string().trim().min(5).max(200).optional(),
  markNoShow: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().trim().min(3).max(32).optional(),
});

const listPayoutsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().trim().min(3).max(32).optional(),
});

const listSupportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().trim().min(3).max(32).optional(),
  priority: z.string().trim().min(3).max(32).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  eventType: z.string().trim().min(3).max(64).optional(),
});

const updateSupportSchema = z.object({
  status: z.string().trim().min(3).max(32).optional(),
  priority: z.string().trim().min(3).max(32).optional(),
  assignedAdminId: z.string().uuid().nullable().optional(),
  adminNote: z.string().trim().max(500).nullable().optional(),
  reason: z.string().trim().max(200).optional(),
});

const upsertSettingSchema = z.object({
  value: z.any(),
  reason: z.string().trim().max(200).optional(),
});

router.get("/dashboard", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const metrics = await getAdminDashboardMetrics();
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
});

router.get("/users", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const { limit, offset, search } = listUsersQuerySchema.parse(req.query);
    const users = await listUsers({ limit, offset, search });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", requireAuth, requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = userStatusSchema.parse(req.body);
    const updated = await updateUserStatus({
      userId: id,
      status: payload.status,
      role: payload.role,
      adminNote: payload.adminNote,
    });
    if (!updated) return res.status(404).json({ message: "User not found or no changes" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_user",
      targetType: "user",
      targetId: id,
      afterState: updated,
      reason: payload.reason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", requireAuth, requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = adminDeleteSchema.parse(req.body ?? {});
    const deleted = await deleteUserAccount(id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "delete_user",
      targetType: "user",
      targetId: id,
      reason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const listingStatusSchema = z.object({
  status: z.enum(["approved", "pending", "rejected", "disabled"]),
  moderationReason: z.string().trim().max(200).optional(),
  moderationNote: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(200).optional(),
});

router.get("/listings", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const { limit, offset, status } = listListingsQuerySchema.parse(req.query);
    const listings = await listListingsForAdmin({ status, limit, offset });
    res.json({ listings });
  } catch (error) {
    next(error);
  }
});

router.patch("/listings/:id", requireAuth, requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = listingStatusSchema.parse(req.body);
    const updated = await updateListingStatus({
      listingId: id,
      status: payload.status,
      moderationReason: payload.moderationReason,
      moderationNote: payload.moderationNote,
    });
    if (!updated) return res.status(404).json({ message: "Listing not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_listing",
      targetType: "listing",
      targetId: id,
      afterState: updated,
      reason: payload.reason ?? payload.moderationReason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.json({ listing: updated });
  } catch (error) {
    next(error);
  }
});

// TODO: Wire this to a daily cron (e.g. CloudWatch/EventBridge) to automate payouts.
router.post("/payouts/run", requireAuth, requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    if (!stripe) return res.json({ processed: 0, skipped: true });

    const due = await listDuePayoutsForAllHosts();
    let processed = 0;
    for (const booking of due) {
      const locked = await markPayoutProcessing(booking.id);
      if (!locked) continue;
      const net = Math.max(0, Number(booking.amount_cents) - Number(booking.fee_cents));
      if (net <= 0) {
        await markPayoutPending(booking.id);
        continue;
      }
      try {
        const transfer = await stripe.transfers.create({
          amount: net,
          currency: booking.currency ?? "eur",
          destination: booking.host_stripe_account_id,
          metadata: { booking_id: booking.id, host_id: booking.host_id },
        });
        await markPayoutTransferred({ bookingId: booking.id, transferId: transfer.id });
        processed += 1;
      } catch {
        await markPayoutPending(booking.id);
      }
    }
    res.json({ processed });
  } catch (error) {
    next(error);
  }
});

router.get("/bookings", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const query = listBookingsQuerySchema.parse(req.query);
    const bookings = await listBookingsForAdmin(query);
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

router.get("/bookings/:id", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const booking = await getBookingForAdmin(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

router.patch("/bookings/:id", requireAuth, requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateBookingSchema.parse(req.body);
    const before = await getBookingForAdmin(id);
    if (!before) return res.status(404).json({ message: "Booking not found" });
    const updated = await updateBookingAsAdmin({
      bookingId: id,
      status: payload.status,
      refundId: payload.refundId ?? null,
      markNoShow: payload.markNoShow ?? false,
    });
    if (!updated) return res.status(404).json({ message: "Booking not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_booking",
      targetType: "booking",
      targetId: id,
      beforeState: before,
      afterState: updated,
      reason: payload.reason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.json({ booking: updated });
  } catch (error) {
    next(error);
  }
});

router.get("/payments", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const query = listPaymentsQuerySchema.parse(req.query);
    const payments = await listPaymentsForAdmin(query);
    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

router.get("/payouts", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const query = listPayoutsQuerySchema.parse(req.query);
    const payouts = await listPayoutsForAdmin(query);
    res.json({ payouts });
  } catch (error) {
    next(error);
  }
});

router.get("/support", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const query = listSupportQuerySchema.parse(req.query);
    const tickets = await listSupportTickets(query);
    res.json({ tickets });
  } catch (error) {
    next(error);
  }
});

router.patch("/support/:id", requireAuth, requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateSupportSchema.parse(req.body);
    const updated = await updateSupportTicket({
      ticketId: id,
      status: payload.status,
      priority: payload.priority,
      assignedAdminId: payload.assignedAdminId ?? undefined,
      adminNote: payload.adminNote ?? undefined,
    });
    if (!updated) return res.status(404).json({ message: "Ticket not found" });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_support_ticket",
      targetType: "support_ticket",
      targetId: id,
      afterState: updated,
      reason: payload.reason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.json({ ticket: updated });
  } catch (error) {
    next(error);
  }
});

router.get("/settings", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const settings = await listAdminSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

router.get("/events", requireAuth, requireAdmin, adminReadLimiter, async (req, res, next) => {
  try {
    const { limit, offset, eventType } = listEventsQuerySchema.parse(req.query);
    const events = await listEventLog({ limit, offset, eventType });
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

router.put("/settings/:key", requireAuth, requireAdmin, adminWriteLimiter, async (req, res, next) => {
  try {
    const key = z.string().trim().min(2).max(80).parse(req.params.key);
    const payload = upsertSettingSchema.parse(req.body ?? {});
    const updated = await upsertAdminSetting({
      key,
      value: payload.value,
      updatedBy: req.user!.userId,
    });
    await insertAuditLog({
      adminId: req.user!.userId,
      action: "update_setting",
      targetType: "admin_setting",
      targetId: undefined,
      afterState: updated,
      reason: payload.reason,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    res.json({ setting: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
