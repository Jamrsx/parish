import { useEffect, useState } from "react";
import {
  BookOpen,
  Church,
  Cross,
  Droplets,
  FileText,
  Flame,
  Heart,
  Home,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { churchServiceAPI, type ChurchService } from "../../../../library/church_service";

/** Saved icon names (must match SERVICE_ICON_MAP in the mobile app). */
export const SERVICE_ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "Church", label: "Church", Icon: Church },
  { value: "Home", label: "Home", Icon: Home },
  { value: "Heart", label: "Heart", Icon: Heart },
  { value: "Cross", label: "Cross", Icon: Cross },
  { value: "Droplets", label: "Water", Icon: Droplets },
  { value: "BookOpen", label: "Book", Icon: BookOpen },
  { value: "FileText", label: "Document", Icon: FileText },
  { value: "Star", label: "Star", Icon: Star },
  { value: "Users", label: "People", Icon: Users },
  { value: "Candle", label: "Candle", Icon: Flame },
];

export const serviceIconFor = (value?: string | null): LucideIcon | null =>
  SERVICE_ICON_OPTIONS.find((option) => option.value === value)?.Icon ?? null;

// ---- Saved icon per service name, loaded once and shared by every page ----

type IconMap = Record<string, string>;

let cache: IconMap | null = null;
let pending: Promise<IconMap> | null = null;
const listeners = new Set<(map: IconMap) => void>();

const keyOf = (name?: string | null) => (name || "").trim().toLowerCase();

const load = (): Promise<IconMap> => {
  if (!pending) {
    pending = churchServiceAPI
      .getAdminAll({ per_page: 100 })
      .then((res) => {
        const data = res.data?.data as unknown;
        const rows: ChurchService[] = Array.isArray(data)
          ? (data as ChurchService[])
          : ((data as { data?: ChurchService[] })?.data ?? []);
        const map: IconMap = {};
        rows.forEach((row) => {
          if (row.icon) map[keyOf(row.service_type)] = row.icon;
        });
        console.log("[ServiceIcons] Loaded saved icons", map);
        cache = map;
        listeners.forEach((fn) => fn(map));
        return map;
      })
      .catch((err) => {
        console.error("[ServiceIcons] Could not load saved icons", err);
        pending = null;
        return cache ?? {};
      });
  }
  return pending;
};

/** Call after a service is saved in Manage Services so every page picks up the new icon. */
export const refreshServiceIcons = () => {
  pending = null;
  return load();
};

/** Saved icon name for a service (e.g. "Heart"), or null while loading / when none is saved. */
export const useSavedServiceIcon = (serviceName?: string | null): string | null => {
  const [map, setMap] = useState<IconMap | null>(cache);

  useEffect(() => {
    listeners.add(setMap);
    if (!cache) load();
    return () => {
      listeners.delete(setMap);
    };
  }, []);

  return map?.[keyOf(serviceName)] ?? null;
};
