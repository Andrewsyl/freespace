"use client";

import { TextField } from "../ui";
import type { HostStepProps } from "./types";

export function HostPricingStep({ data, onUpdate }: HostStepProps) {
  const value = data.pricePerDay ?? "";

  return (
    <div className="space-y-2">
      <TextField
        type="number"
        min={1}
        step={1}
        label="Price per day (€)"
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          onUpdate({ pricePerDay: Number.isNaN(parsed) ? undefined : parsed });
        }}
        placeholder="15"
        hint="You can update pricing anytime from your dashboard."
        wrapperClassName="sm:w-64"
      />
    </div>
  );
}
