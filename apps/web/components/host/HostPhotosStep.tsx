"use client";
import { X, ImageIcon } from "lucide-react";

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
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
            <ImageIcon className="h-8 w-8 text-slate-400" strokeWidth={1.4} />
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
