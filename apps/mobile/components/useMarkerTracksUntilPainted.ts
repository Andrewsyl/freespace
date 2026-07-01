import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

// react-native-maps draws the default red pin for a custom marker until its child
// view has painted a bitmap. A marker with tracksViewChanges={false} snapshots once
// and can catch that empty frame — stranding / flashing the red default.
//
// This hook starts tracking (true) and flips it off only after the map settles and
// two animation frames have passed, so the custom child has definitely composited.
// Pass a key (e.g. the coordinate) so a marker that moves re-tracks its new frame.
export function useMarkerTracksUntilPainted(resetKey?: unknown): boolean {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const task = InteractionManager.runAfterInteractions(() => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) setTracks(false);
        });
      });
    });
    return () => {
      cancelled = true;
      task.cancel?.();
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [resetKey]);

  return tracks;
}
