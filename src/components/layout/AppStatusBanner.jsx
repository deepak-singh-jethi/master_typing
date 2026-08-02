import { Link } from "react-router-dom";
import { CloudOff, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { useApp } from "@/hooks/useApp";
import { useAuth } from "@/hooks/useAuth";

export function AppStatusBanner() {
  const { syncStatus, syncError, syncNotice, syncNow } = useApp();
  const { configured, serviceError, retryService } = useAuth();
  const [dismissedNotice, setDismissedNotice] = useState("");

  const authProblem = configured && Boolean(serviceError);
  const isProblem = authProblem || syncStatus === "offline" || syncStatus === "error";
  const notice = syncNotice && syncNotice !== dismissedNotice ? syncNotice : "";
  if (!isProblem && !notice) return null;

  const offline = !authProblem && syncStatus === "offline";
  const Icon = offline ? CloudOff : notice ? RefreshCw : TriangleAlert;
  const title = authProblem
    ? "Account service is unavailable"
    : offline
    ? "You are offline"
    : syncStatus === "error"
      ? "Cloud sync needs attention"
      : "Progress updated";
  const description = authProblem
    ? `${serviceError} Account data has not been treated as guest data. Retry before signing in or syncing.`
    : offline
    ? "Practice is still saved on this device. Sync will retry after reconnection."
    : syncError || notice;

  return (
    <div
      role={authProblem || syncStatus === "error" ? "alert" : "status"}
      className={`border-b px-4 py-3 sm:px-6 lg:ml-56 lg:px-8 ${
        authProblem || syncStatus === "error"
          ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200"
          : offline
            ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200"
            : "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-200"
      }`}
    >
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 size-4 shrink-0 ${syncStatus === "syncing" ? "animate-spin" : ""}`} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {description && <p className="mt-0.5 text-xs leading-5 opacity-80">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 pl-7 sm:pl-0">
          {isProblem && !offline && (
            <Button size="sm" variant="secondary" onClick={authProblem ? retryService : syncNow}>
              <RefreshCw className="size-3.5" aria-hidden="true" />{authProblem ? "Retry account service" : "Retry sync"}
            </Button>
          )}
          {isProblem && (
            <Button as={Link} to="/account" size="sm" variant="ghost">Account</Button>
          )}
          {notice && !isProblem && (
            <button
              type="button"
              onClick={() => setDismissedNotice(notice)}
              className="grid size-9 place-items-center rounded-xl transition hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Dismiss progress notice"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
