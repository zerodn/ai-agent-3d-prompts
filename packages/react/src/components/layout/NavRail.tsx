import { Activity, LayoutDashboard, ListChecks, Settings, Users } from "lucide-react";
import { forwardRef } from "react";
import { useWorldStore, type PanelTab } from "../../state/useWorldStore";
import { cx } from "../ui";

const ITEMS: { tab: PanelTab; label: string; icon: typeof Activity }[] = [
  { tab: "overview", label: "Overview", icon: LayoutDashboard },
  { tab: "agents", label: "Agents", icon: Users },
  { tab: "tasks", label: "Tasks", icon: ListChecks },
  { tab: "activity", label: "Activity", icon: Activity },
  { tab: "settings", label: "Settings", icon: Settings },
];

export const NavRail = forwardRef<HTMLElement>(function NavRail(_, ref) {
  const tab = useWorldStore((s) => s.tab);
  const setTab = useWorldStore((s) => s.setTab);
  return (
    <nav
      ref={ref}
      aria-label="Panels"
      className="surface pointer-events-auto flex items-center gap-1 p-1.5 max-md:order-last max-md:justify-around md:flex-col md:py-2.5"
    >
      <div className="mb-2 hidden h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-signal to-[#a78bfa] text-[13px] font-bold text-ink-950 md:flex" aria-hidden="true">
        AW
      </div>
      {ITEMS.map(({ tab: t, label, icon: Icon }) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          aria-label={label}
          aria-current={tab === t ? "page" : undefined}
          title={label}
          className={cx(
            "flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors",
            tab === t ? "bg-white/10 text-signal-strong" : "text-mist-500 hover:bg-white/5 hover:text-mist-100",
          )}
        >
          <Icon size={18} />
        </button>
      ))}
    </nav>
  );
});
