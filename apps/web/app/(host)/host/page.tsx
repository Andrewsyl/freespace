"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createListing } from "../../../lib/api";
import { useAuth } from "../../../components/AuthProvider";
import { HostStepperLayout } from "../../../components/host/HostStepperLayout";
import { HostAddressStep } from "../../../components/host/HostAddressStep";
import { HostStreetViewStep } from "../../../components/host/HostStreetViewStep";
import { HostDetailsStep } from "../../../components/host/HostDetailsStep";
import { HostFeaturesStep } from "../../../components/host/HostFeaturesStep";
import { HostAvailabilityStep } from "../../../components/host/HostAvailabilityStep";
import { HostPricingStep } from "../../../components/host/HostPricingStep";
import { HostPhotosStep } from "../../../components/host/HostPhotosStep";
import { HostConfirmationStep } from "../../../components/host/HostConfirmationStep";
import type { HostListingDraft } from "../../../components/host/types";
import { buildTitleFromDraft } from "../../../components/host/utils";

const DRAFT_KEY = "host-listing-draft";

const DEFAULT_DRAFT: HostListingDraft = {
  address: "",
  latitude: undefined,
  longitude: undefined,
  locationConfirmed: false,
  coverHeading: undefined,
  coverPitch: undefined,
  spaceType: undefined,
  spaceCount: "",
  vehicleSize: undefined,
  title: "",
  availabilityText: "",
  requiresAccessCode: null,
  accessType: undefined,
  accessInstructions: "",
  pricingMode: "both",
  pricePerHour: 1,
  pricePerDay: 12,
  pricePerMonth: 100,
  amenities: [],
  imageUrls: [],
};

//
// Step index → description
// 0  Address        pin your exact spot
// 1  Street View    pick cover angle (skippable)
// 2  Space details  type → count → vehicle (progressive)
// 3  Features       amenities + access (progressive)
// 4  Availability   when is it available
// 5  Pricing        daily rate
// 6  Photos         upload images
// 7  Review         confirm & publish
//

const STEPS = [
  { title: "Confirm location",      description: "Drag the map to place the pin at your exact entrance." },
  { title: "Street view",           description: "Pick the angle that best shows your parking entrance." },
  { title: "Your space",            description: "Tell drivers what kind of spot you have." },
  { title: "Features & access",     description: "Add the practical details that help drivers trust the space." },
  { title: "Availability",          description: "When is your space available to book?" },
  { title: "Set your price",        description: "You can update pricing anytime from your dashboard." },
  { title: "Add photos",            description: "Listings with photos get significantly more bookings." },
  { title: "Review & publish",      description: "Check everything before going live." },
];

export default function HostWizardPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<HostListingDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Restore draft from localStorage ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  // ── Keep draft in sync ───────────────────────────────────────────────────────
  const updateDraft = (partial: Partial<HostListingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      }
      return next;
    });
    setError(null);
  };

  // ── Auto-generate title ──────────────────────────────────────────────────────
  useEffect(() => {
    const generated = buildTitleFromDraft(draft);
    if (generated !== draft.title) updateDraft({ title: generated });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.address, draft.spaceType]);

  // ── Step validation ──────────────────────────────────────────────────────────
  const isStepValid = (index: number): boolean => {
    switch (index) {
      case 0: // Address
        return Boolean(
          draft.address &&
          draft.latitude !== undefined &&
          draft.longitude !== undefined &&
          draft.locationConfirmed
        );
      case 1: // Street View — always skippable
        return true;
      case 2: // Space details — all 3 required
        return Boolean(draft.spaceType) && Boolean(draft.spaceCount) && Boolean(draft.vehicleSize);
      case 3: { // Features & access — must answer Yes/No; if Yes, must pick type + text
        if (draft.requiresAccessCode === null || draft.requiresAccessCode === undefined) return false;
        if (draft.requiresAccessCode === false) return true;
        if (!draft.accessType) return false;
        return (draft.accessInstructions ?? "").trim().length > 0;
      }
      case 4: // Availability
        return draft.availabilityText.trim().length > 3;
      case 5: // Pricing
        return draft.pricingMode === "monthly"
          ? typeof draft.pricePerMonth === "number" && draft.pricePerMonth > 0
          : draft.pricingMode === "both"
            ? typeof draft.pricePerHour === "number" &&
              draft.pricePerHour > 0 &&
              typeof draft.pricePerDay === "number" &&
              draft.pricePerDay > 0 &&
              typeof draft.pricePerMonth === "number" &&
              draft.pricePerMonth > 0
            : typeof draft.pricePerHour === "number" &&
              draft.pricePerHour > 0 &&
              typeof draft.pricePerDay === "number" &&
              draft.pricePerDay > 0;
      case 6: // Photos — optional but must have at least 1 to proceed (or skip)
        return true;
      default: // Review
        return true;
    }
  };

  const nextDisabled =
    loading || (stepIndex === STEPS.length - 1 ? saving : !isStepValid(stepIndex));

  const handleNext = () => {
    if (!isStepValid(stepIndex)) {
      setError("Please complete this step before continuing.");
      return;
    }
    setError(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  // ── Publish ──────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!token) {
      setError("Please sign in to publish your listing.");
      return;
    }
    if (!isStepValid(5)) {
      setError("Finish pricing before publishing.");
      setStepIndex(5);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createListing(
        {
          title: buildTitleFromDraft(draft),
          address: draft.address,
          rateType: typeof draft.pricePerHour === "number" && draft.pricePerHour > 0 ? "hourly" : "daily",
          pricePerDay: draft.pricePerDay ?? 0,
          pricePerHour: draft.pricingMode === "monthly" ? null : draft.pricePerHour ?? null,
          pricePerMonth: draft.pricingMode === "hourly_daily" ? null : draft.pricePerMonth ?? null,
          availabilityText: draft.availabilityText,
          latitude: draft.latitude ?? 0,
          longitude: draft.longitude ?? 0,
          amenities: draft.amenities,
          imageUrls: draft.imageUrls,
        },
        token
      );
      window.localStorage.removeItem(DRAFT_KEY);
      router.push("/host/dashboard?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish listing");
      setSaving(false);
    }
  };

  // ── Not signed in ────────────────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-5 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-2 ring-emerald-100">
          <svg className="h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 21V10.75m0 0c0-1.033 1.117-1.545 1.875-.875L12 15.5l7.875-5.625c.758-.67 1.875-.158 1.875.875" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">List your space</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to start earning from your parking space.</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: "#2ECC8F" }}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  // ── Render current step ──────────────────────────────────────────────────────
  const renderStep = () => {
    switch (stepIndex) {
      case 0: return <HostAddressStep    data={draft} onUpdate={updateDraft} />;
      case 1: return <HostStreetViewStep data={draft} onUpdate={updateDraft} />;
      case 2: return <HostDetailsStep    data={draft} onUpdate={updateDraft} />;
      case 3: return <HostFeaturesStep   data={draft} onUpdate={updateDraft} />;
      case 4: return <HostAvailabilityStep data={draft} onUpdate={updateDraft} />;
      case 5: return <HostPricingStep    data={draft} onUpdate={updateDraft} />;
      case 6: return <HostPhotosStep     data={draft} onUpdate={updateDraft} />;
      default:return <HostConfirmationStep data={draft} onUpdate={updateDraft} />;
    }
  };

  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <HostStepperLayout
      title={STEPS[stepIndex].title}
      description={STEPS[stepIndex].description}
      step={stepIndex + 1}
      totalSteps={STEPS.length}
      onBack={stepIndex === 0 ? undefined : handleBack}
      onNext={isLastStep ? handlePublish : handleNext}
      nextLabel={isLastStep ? "Publish listing" : "Continue"}
      nextDisabled={nextDisabled}
      loading={saving}
      error={error}
    >
      {renderStep()}
    </HostStepperLayout>
  );
}
