import { forwardRef } from "react";
import { useWorldStore, type CameraPresetId } from "../../state/useWorldStore";
import { CAMERA_PRESETS } from "../../world/cameraPresets";

export const CameraBar = forwardRef<HTMLDivElement>(function CameraBar(_, ref) {
  const requestCamera = useWorldStore((s) => s.requestCamera);
  const follow = useWorldStore((s) => s.follow);
  return (
    <div ref={ref} className="surface scroll-thin pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto p-1" role="toolbar" aria-label="Camera presets">
      {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((id) => (
        <button
          key={id}
          type="button"
          className="btn btn-quiet h-7 shrink-0 px-2.5 text-[12px]"
          onClick={() => {
            follow(null);
            requestCamera({ preset: id });
          }}
        >
          {CAMERA_PRESETS[id].label}
        </button>
      ))}
    </div>
  );
});
