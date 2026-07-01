"use client";
import { X, ImageIcon, GripVertical, Eye } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ImageUploader } from "../ImageUploader";
import { SectionIntro, TipCallout } from "./_ui";
import type { HostStepProps } from "./types";
import { buildStreetViewCoverUrl, isStreetViewUrl } from "./utils";

export function HostPhotosStep({ data, onUpdate }: HostStepProps) {
  // Seed the Street View cover the host framed earlier as the first photo, once.
  // After this it's a normal gallery item — reorderable and removable — so any
  // edits the host makes here stick.
  useEffect(() => {
    if (data.coverInjected) return;
    const cover = buildStreetViewCoverUrl(data);
    if (!cover) {
      onUpdate({ coverInjected: true });
      return;
    }
    onUpdate({
      imageUrls: [cover, ...data.imageUrls.filter((u) => u !== cover)],
      coverInjected: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Refs mirror the drag state so the window-level pointer listeners (added once
  // per drag) always read the latest values without re-binding.
  const dragIndexRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const imageUrlsRef = useRef<string[]>(data.imageUrls);
  imageUrlsRef.current = data.imageUrls;

  const setDrag = (i: number | null) => {
    dragIndexRef.current = i;
    setDragIndex(i);
  };
  const setOver = (i: number | null) => {
    overIndexRef.current = i;
    setOverIndex(i);
  };

  const removePhoto = (idx: number) => {
    onUpdate({ imageUrls: data.imageUrls.filter((_, i) => i !== idx) });
  };

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0) return;
      const next = [...imageUrlsRef.current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onUpdate({ imageUrls: next });
    },
    [onUpdate]
  );

  // ── Pointer-based drag (works on touch + mouse) ──────────────────────────────
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (dragIndexRef.current === null) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tile = el?.closest<HTMLElement>("[data-photo-index]");
    if (!tile) return;
    const idx = Number(tile.dataset.photoIndex);
    if (!Number.isNaN(idx)) setOver(idx);
  }, []);

  const handlePointerUp = useCallback(() => {
    const from = dragIndexRef.current;
    const to = overIndexRef.current;
    if (from !== null && to !== null) move(from, to);
    setDrag(null);
    setOver(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  }, [move, handlePointerMove]);

  const startDrag = (e: React.PointerEvent, idx: number) => {
    // Only primary button / single touch.
    if (e.button != null && e.button > 0) return;
    e.preventDefault();
    setDrag(idx);
    setOver(idx);
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  // Clean up listeners if we unmount mid-drag.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const hasPhotos = data.imageUrls.length > 0;

  return (
    <div className="space-y-10">
      <div>
        <SectionIntro label="Photos">
          Add at least 3 clear photos — the entrance, the bay, and any nearby landmarks.
        </SectionIntro>

        <ImageUploader onUpload={(url) => onUpdate({ imageUrls: [...data.imageUrls, url] })} />

        {hasPhotos ? (
          <>
            <p className="mt-4 text-[12.5px] font-medium text-slate-500">
              Drag a photo by its handle to reorder. The first photo is your cover.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {data.imageUrls.map((url, idx) => {
                const isCover = idx === 0;
                const fromStreetView = isStreetViewUrl(url);
                const isDragged = dragIndex === idx;
                const isOver = overIndex === idx && dragIndex !== idx;
                return (
                  <div
                    key={url + idx}
                    data-photo-index={idx}
                    className={`group relative aspect-[4/3] select-none overflow-hidden rounded-2xl border bg-slate-100 transition ${
                      isOver ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200"
                    } ${isDragged ? "opacity-40" : ""}`}
                  >
                    <img
                      src={url}
                      alt="Listing photo"
                      className="pointer-events-none h-full w-full object-cover"
                      draggable={false}
                    />

                    {/* Cover badge on the first photo */}
                    {isCover && (
                      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                        Cover
                      </span>
                    )}

                    {/* Street-view origin hint */}
                    {fromStreetView && (
                      <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-slate-900/55 px-1.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                        <Eye className="h-3 w-3" strokeWidth={2.5} />
                        Street view
                      </span>
                    )}

                    {/* Drag handle — pointer events unify touch + mouse; touch-action
                        none stops the page scrolling when a drag starts here. */}
                    <button
                      type="button"
                      aria-label="Drag to reorder"
                      onPointerDown={(e) => startDrag(e, idx)}
                      style={{ touchAction: "none" }}
                      className="absolute bottom-2 left-2 flex cursor-grab items-center gap-1 rounded-md bg-slate-900/65 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm transition active:cursor-grabbing hover:bg-slate-900/80"
                    >
                      <GripVertical className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Drag
                    </button>

                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      aria-label="Remove photo"
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition hover:bg-slate-900"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
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
