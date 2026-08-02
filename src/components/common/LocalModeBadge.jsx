import {
  Cloud,
  CloudOff,
  HardDrive,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const stateConfig = {
  local: {
    icon: HardDrive,
    compact: "Local",
    label: "Saved on this device",
    className: "text-slate-500 dark:text-slate-300",
  },
  guest: {
    icon: UserRound,
    compact: "Guest",
    label: "Guest · saved on this device",
    className: "text-slate-500 dark:text-slate-300",
  },
  syncing: {
    icon: RefreshCw,
    compact: "Syncing",
    label: "Saving automatically",
    className: "text-indigo-600 dark:text-indigo-300",
    spin: true,
  },
  synced: {
    icon: Cloud,
    compact: "Synced",
    label: "Automatic backup current",
    className: "text-emerald-600 dark:text-emerald-300",
  },
  offline: {
    icon: CloudOff,
    compact: "Offline",
    label: "Offline · sync will retry",
    className: "text-amber-600 dark:text-amber-300",
  },
  error: {
    icon: CloudOff,
    compact: "Sync issue",
    label: "Cloud sync needs attention",
    className: "text-rose-600 dark:text-rose-300",
  },
};

export function LocalModeBadge({ compact = false }) {
  const { syncStatus = "local", syncError = null } = useApp();
  const { configured, user } = useAuth();
  const effectiveStatus = !configured ? "local" : user ? syncStatus : "guest";
  const state = stateConfig[effectiveStatus] ?? stateConfig.local;
  const Icon = state.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold backdrop-blur dark:border-slate-700 dark:bg-slate-900/80",
        state.className,
      )}
      title={syncError || state.label}
      role="status"
      aria-live="polite"
      aria-label={syncError ? `${state.label}. ${syncError}` : state.label}
    >
      <Icon aria-hidden="true" className={cn("size-3.5", state.spin && "animate-spin")} />
      {compact ? state.compact : state.label}
    </div>
  );
}
