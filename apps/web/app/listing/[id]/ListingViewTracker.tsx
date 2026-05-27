"use client";

import { useEffect } from "react";
import { trackEvent } from "../../../lib/telemetry";

export function ListingViewTracker({
  listingId,
  title,
}: {
  listingId: string;
  title: string;
}) {
  useEffect(() => {
    void trackEvent("web_listing_viewed", {
      listingId,
      title,
    });
  }, [listingId, title]);

  return null;
}
