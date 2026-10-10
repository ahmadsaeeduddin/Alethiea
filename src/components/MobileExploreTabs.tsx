"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type TabId = "map" | "priority" | "inspector";

const TAB_ORDER: TabId[] = ["map", "priority", "inspector"];

const TAB_META: Record<TabId, { label: string; icon: string }> = {
  map: { label: "Map", icon: "◉" },
  priority: { label: "Priority", icon: "☰" },
  inspector: { label: "Inspector", icon: "ⓘ" },
};

interface MobileExploreTabsProps {
  mapSlot: ReactNode;
  prioritySlot: ReactNode;
  inspectorSlot: ReactNode;
  /** Changes when a new cell is selected on the map (triggers auto-switch once per area). */
  hasSelection: boolean;
  /** Changes when a scenario proposal is active (triggers auto-switch once per area). */
  hasProposal: boolean;
  /** Changes whenever the study area is reset — used to clear the auto-switch latches. */
  requestKey: string;
}

export function MobileExploreTabs({
  mapSlot,
  prioritySlot,
  inspectorSlot,
  hasSelection,
  hasProposal,
}: MobileExploreTabsProps) {
  // Parent remounts us with key={requestKey} on area change, so initial state resets automatically.
  const [active, setActive] = useState<TabId>("map");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    map: null,
    priority: null,
    inspector: null,
  });

  // Independent latches so first-selection and first-proposal each fire once per mount.
  const didAutoSwitchOnSelectRef = useRef(false);
  const didAutoSwitchOnProposeRef = useRef(false);

  useEffect(() => {
    if (hasSelection && !didAutoSwitchOnSelectRef.current) {
      didAutoSwitchOnSelectRef.current = true;
      setActive("inspector");
    }
  }, [hasSelection]);

  useEffect(() => {
    if (hasProposal && !didAutoSwitchOnProposeRef.current) {
      didAutoSwitchOnProposeRef.current = true;
      setActive("inspector");
    }
  }, [hasProposal]);

  const slot: Record<TabId, ReactNode> = {
    map: mapSlot,
    priority: prioritySlot,
    inspector: inspectorSlot,
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % TAB_ORDER.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TAB_ORDER.length - 1;
    if (next !== null) {
      event.preventDefault();
      const nextId = TAB_ORDER[next];
      setActive(nextId);
      tabRefs.current[nextId]?.focus();
    }
  };

  return (
    <div className="pb-24 lg:hidden">
      <div
        key={active}
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="motion-safe:animate-fade-in"
      >
        {slot[active]}
      </div>

      <nav
        role="tablist"
        aria-label="Dashboard view"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--color-surface-glass)] shadow-[0_-8px_24px_rgba(39,65,43,0.08)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-[1600px] px-2 py-2">
          {TAB_ORDER.map((id, index) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                {...(isActive ? { "aria-controls": `panel-${id}` } : {})}
                onClick={() => setActive(id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={`relative mx-1 flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] ${
                  isActive
                    ? "bg-[var(--green-dark)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--green-dark)]"
                }`}
              >
                <span aria-hidden="true" className="text-base">
                  {TAB_META[id].icon}
                </span>
                <span>{TAB_META[id].label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
