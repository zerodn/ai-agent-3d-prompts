import { forwardRef } from "react";
import { useWorldStore } from "../../state/useWorldStore";
import { ActivePanel, PANEL_TITLES } from "./Panels";

/** Right column on desktop, a 40dvh bottom sheet on mobile. */
export const SidePanel = forwardRef<HTMLElement>(function SidePanel(_, ref) {
  const tab = useWorldStore((s) => s.tab);
  return (
    <aside
      ref={ref}
      aria-label={PANEL_TITLES[tab]}
      className="surface pointer-events-auto flex min-h-0 flex-col max-md:h-[40dvh] max-md:shrink-0 md:w-[380px] md:shrink-0 xl:w-[400px]"
    >
      <h2 className="border-b border-white/[0.06] px-4 py-3 text-[13px] font-semibold">{PANEL_TITLES[tab]}</h2>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ActivePanel />
      </div>
    </aside>
  );
});
