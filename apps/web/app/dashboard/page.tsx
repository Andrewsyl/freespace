import { redirect } from "next/navigation";

// The driver's bookings live in one canonical place: /bookings ("My bookings").
// This page used to be a second, divergent bookings view; it now redirects so
// there's a single Trips surface. Host booking management lives in /host/dashboard.
export default function DashboardPage() {
  redirect("/bookings");
}
