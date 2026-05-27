"use client";

import { ImageUploader } from "../ImageUploader";
import type { HostStepProps } from "./types";

export function HostPhotosStep({ data, onUpdate }: HostStepProps) {
  const removePhoto = (idx: number) => {
    onUpdate({ imageUrls: data.imageUrls.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Better photos improve trust and booking conversion. You can add more later from your dashboard.
      </p>

      {/* Upload button */}
      <ImageUploader
        onUpload={(url) => onUpdate({ imageUrls: [...data.imageUrls, url] })}
      />

      {/* Photo grid */}
      {data.imageUrls.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
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
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No photos yet</p>
            <p className="mt-0.5 text-xs text-slate-400">Listings with photos get significantly more bookings</p>
          </div>
        </div>
      )}
    </div>
  );
}
