"use client";
import { X, ImageIcon } from "lucide-react";

import { ImageUploader } from "../ImageUploader";
import { SectionIntro, TipCallout } from "./_ui";
import type { HostStepProps } from "./types";

export function HostPhotosStep({ data, onUpdate }: HostStepProps) {
  const removePhoto = (idx: number) => {
    onUpdate({ imageUrls: data.imageUrls.filter((_, i) => i !== idx) });
  };

  const hasPhotos = data.imageUrls.length > 0;

  return (
    <div className="space-y-10">
      <div>
        <SectionIntro label="Photos">
          Add at least 3 clear photos — the entrance, the bay, and any nearby landmarks.
        </SectionIntro>

        <ImageUploader onUpload={(url) => onUpdate({ imageUrls: [...data.imageUrls, url] })} />

        {hasPhotos ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {data.imageUrls.map((url, idx) => (
              <div
                key={url + idx}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
              >
                <img src={url} alt="Listing photo" className="h-full w-full object-cover" />
                {idx === 0 && (
                  <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  aria-label="Remove photo"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition hover:bg-slate-900"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
              <ImageIcon className="h-7 w-7 text-slate-400" strokeWidth={1.4} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-slate-700">No photos yet</p>
              <p className="mt-0.5 text-[13px] text-slate-500">Use the button above to add your first photo.</p>
            </div>
          </div>
        )}
      </div>

      <TipCallout title="Great photos get 4× more bookings">
        Natural daylight and a tidy, empty space make the biggest difference. The first photo becomes your cover image.
      </TipCallout>
    </div>
  );
}
