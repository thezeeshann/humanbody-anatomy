// shadcn/ui (Base UI) pieces mounted into the vanilla page as small React islands: the side panel's
// scroll area, the voice and speed pickers of the Listen bar, and the skeleton shown while a body loads.
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// The panel body scrolls inside a ScrollArea, so the native scrollbar is replaced by a thin overlay
// thumb. Returns the scrolling viewport and the content element that main.ts fills.
export function mountPanelScroll(host: HTMLElement): { viewport: HTMLElement; body: HTMLElement } {
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      <ScrollArea className="hb-scroll h-full min-h-0">
        <div className="hb-panel-body" aria-live="polite" />
      </ScrollArea>,
    ),
  );
  return { viewport: host.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']")!, body: host.querySelector<HTMLElement>(".hb-panel-body")! };
}

// The loading placeholder: a standing figure built from shadcn Skeletons, roughly where the model will
// appear on its stand. Parts are [x, y, w, h, rotate°, rounding] in a 90 × 200 box (x is the centre).
const FIGURE: [x: number, y: number, w: number, h: number, rotate: number, rounding: string][] = [
  [45, 0, 18, 25, 0, "rounded-[50%]"], // head
  [45, 22, 8, 10, 0, "rounded-md"], // neck
  [45, 29, 38, 58, 0, "rounded-t-[45%] rounded-b-[30%]"], // chest and belly
  [45, 80, 34, 28, 0, "rounded-[35%]"], // hips
  [22, 31, 9, 45, 9, "rounded-full"], // upper arms
  [68, 31, 9, 45, -9, "rounded-full"],
  [17, 72, 8, 40, 5, "rounded-full"], // forearms and hands
  [73, 72, 8, 40, -5, "rounded-full"],
  [37, 100, 14, 94, 2, "rounded-full"], // legs
  [53, 100, 14, 94, -2, "rounded-full"],
  [34, 190, 11, 7, 0, "rounded-full"], // feet
  [56, 190, 11, 7, 0, "rounded-full"],
];
export function mountLoader(host: HTMLElement) {
  flushSync(() =>
    createRoot(host).render(
      FIGURE.map(([x, y, w, h, r, round], i) => (
        <Skeleton
          key={i}
          className={`absolute bg-[#ebebeb] ${round}`}
          style={{ left: `${((x - w / 2) / 90) * 100}%`, top: `${(y / 200) * 100}%`, width: `${(w / 90) * 100}%`, height: `${(h / 200) * 100}%`, rotate: `${r}deg`, transformOrigin: "50% 0" }}
        />
      )),
    ),
  );
}

// A shadcn Select fed from a tiny store, so vanilla code can push items and the value.
export interface SelectItemData {
  value: string;
  label: string;
}
interface SelectState {
  items: SelectItemData[];
  value: string | null;
}
export interface SelectStore {
  get: () => SelectState;
  sub: (fn: () => void) => () => void;
  set: (next: Partial<SelectState>) => void;
}
interface SelectOptions extends Partial<SelectState> {
  label: string;
  className?: string;
  minWidth?: string;
  onChange: (value: string) => void;
}
export function mountSelect(host: HTMLElement, { label, className = "", minWidth = "min-w-56", onChange, items = [], value = null }: SelectOptions): SelectStore {
  let state: SelectState = { items, value };
  const subs = new Set<() => void>();
  const store: SelectStore = {
    get: () => state,
    sub: (fn) => (subs.add(fn), () => void subs.delete(fn)),
    set: (next) => ((state = { ...state, ...next }), subs.forEach((fn) => fn())),
  };
  function Picker() {
    const { items, value } = useSyncExternalStore(store.sub, store.get);
    if (!items.length) return null;
    return (
      <Select
        items={items}
        value={value}
        onValueChange={(v) => {
          if (v === null) return;
          store.set({ value: v });
          onChange(v);
        }}
      >
        <SelectTrigger className={`h-8 rounded-full bg-white px-3 text-[12.5px] font-medium ${className}`} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" className={minWidth}>
          {items.map((it) => (
            <SelectItem key={it.value} value={it.value} className="text-[13px]">
              {it.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  createRoot(host).render(<Picker />);
  return store;
}
