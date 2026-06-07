"use client";
import { X, ImageIcon } from "lucide-react";

import { ImageUploader } from "../ImageUploader";
import type { HostStepProps } from "./types";

export function HostPhotosStep({ data, onUpdate }: HostStepProps) {
  const removePhoto = (idx: number) => {
    onUpdate({ imageUrls: data.imageUrls.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {/* Photos card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-300">Photos</p>

        <ImageUploader
          onUpload={(url) => onUpdate({ imageUrls: [...data.imageUrls, url] })}
        />

        {data.imageUrls.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {data.imageUrls.map((url, idx) => (
              <div
                key={url + idx}
                className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                <img src={url} alt="Listing photo" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition hover:bg-slate-900"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <ImageIcon className="h-7 w-7 text-slate-600" strokeWidth={1.4} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">No photos yet</p>
              <p className="mt-0.5 text-xs text-slate-600">Tap the button above to add photos</p>
            </div>
          </div>
        )}
      </div>

      {/* Tips callout */}
      <div className="rounded-lg bg-brand-50 px-4 py-4 ring-1 ring-brand-100">
        <p className="text-sm font-semibold text-brand-800">Photos matter</p>
        <p className="mt-1 text-xs leading-relaxed text-brand-700">
          Listings with at least 3 photos get significantly more bookings. Show the entrance, the bay, and any nearby landmarks.
        </p>
      </div>
    </div>
  );
}
