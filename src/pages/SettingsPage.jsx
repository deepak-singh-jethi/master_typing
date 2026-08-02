import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock3,
  Cloud,
  Download,
  HardDrive,
  Keyboard,
  Monitor,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Upload,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { useApp } from "@/hooks/useApp";
import { useAuth } from "@/hooks/useAuth";
import { getCourseProgress } from "@/lib/adaptiveLearning";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const {
    data,
    updateProfile,
    updateSettings,
    exportData,
    importData,
    resetData,
    storageHealth,
    refreshStorageHealth,
    pruneHistory,
    syncStatus,
    syncError,
  } = useApp();
  const { user } = useAuth();
  const course = getCourseProgress(data);
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState({ text: "", tone: "success" });

  const exportProgress = async () => {
    try {
      const backup = await exportData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `typing-master-progress-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ text: "Complete progress backup exported successfully.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "Unable to export progress.", tone: "error" });
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("This progress backup is larger than the safe 25 MB import limit.");
      }
      const value = JSON.parse(await file.text());
      await importData(value);
      setMessage({ text: "Backup merged successfully. Newer progress already on this device was preserved.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "Unable to import this file.", tone: "error" });
    } finally {
      event.target.value = "";
    }
  };

  const handleReset = async () => {
    if (user) {
      setMessage({ text: "Sign out before resetting guest data. Signed-in progress is protected by cloud sync.", tone: "error" });
      return;
    }
    if (!window.confirm("Delete all Typing Master guest progress and settings stored in this browser? This cannot be undone unless you exported a backup.")) return;
    try {
      const reset = await resetData();
      setMessage(reset
        ? { text: "Guest progress was reset.", tone: "success" }
        : { text: "Guest progress could not be reset.", tone: "error" });
    } catch (error) {
      setMessage({ text: error.message || "Guest progress could not be reset.", tone: "error" });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Preferences"
        title="Make practice comfortable and predictable"
        description={user ? "Preferences are saved locally first and synced to your account when online." : "Guest settings and learning data remain in this browser until you create an account."}
      />

      {message.text && (
        <div role={message.tone === "error" ? "alert" : "status"} aria-live="polite" className={cn(
          "rounded-2xl border px-4 py-3 text-sm font-medium",
          message.tone === "error"
            ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
        )}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={ShieldCheck} title="Learner profile" description={user ? "Personalises the dashboard and syncs with your account." : "Personalises the dashboard on this device."} />
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Display name">
                <input
                  value={data.profile.name}
                  onChange={(event) => updateProfile({ name: event.target.value.slice(0, 40) })}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </Field>
              <Field label="Primary goal">
                <select
                  value={data.profile.primaryGoal}
                  onChange={(event) => updateProfile({ primaryGoal: event.target.value })}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="accuracy">Accuracy</option>
                  <option value="speed">Speed</option>
                  <option value="work">Practical typing</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeader icon={Monitor} title="Appearance" description="Choose a theme and typing text that remain easy to read." />
            <div className="mt-6 space-y-6">
              <Field label="Theme">
                <div className="grid grid-cols-3 gap-2">
                  <ThemeChoice icon={Monitor} label="System" active={data.settings.theme === "system"} onClick={() => updateSettings({ theme: "system" })} />
                  <ThemeChoice icon={Sun} label="Light" active={data.settings.theme === "light"} onClick={() => updateSettings({ theme: "light" })} />
                  <ThemeChoice icon={Moon} label="Dark" active={data.settings.theme === "dark"} onClick={() => updateSettings({ theme: "dark" })} />
                </div>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Typing text size">
                  <select value={data.settings.textSize} onChange={(event) => updateSettings({ textSize: event.target.value })} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </Field>
                <Field label="Caret style">
                  <select value={data.settings.caretStyle} onChange={(event) => updateSettings({ caretStyle: event.target.value })} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="bar">Vertical bar</option>
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                  </select>
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeader icon={Keyboard} title="Typing behaviour" description="Set how sessions respond while you practise." />
            <div className="mt-6 space-y-3">
              <SettingToggle label="Show on-screen keyboard" description="Useful while learning key positions; hide it for tests." active={data.settings.showKeyboard} onClick={() => updateSettings({ showKeyboard: !data.settings.showKeyboard })} />
              <SettingToggle label="Show live WPM" description="Turn off if the number distracts you during practice." active={data.settings.showLiveWpm} onClick={() => updateSettings({ showLiveWpm: !data.settings.showLiveWpm })} />
              <SettingToggle label="Show live accuracy" description="Keep visible when accuracy is your primary goal." active={data.settings.showLiveAccuracy} onClick={() => updateSettings({ showLiveAccuracy: !data.settings.showLiveAccuracy })} />
              <SettingToggle label="Pause when the tab is hidden" description="Prevents inactive time from affecting the result." active={data.settings.autoPause} onClick={() => updateSettings({ autoPause: !data.settings.autoPause })} />
              <SettingToggle icon={Volume2} label="Key sounds" description="A light sound for correct and incorrect presses." active={data.settings.soundEnabled} onClick={() => updateSettings({ soundEnabled: !data.settings.soundEnabled })} />
              <SettingToggle label="Reduce motion" description="Removes non-essential page and interface animation." active={data.settings.reduceMotion} onClick={() => updateSettings({ reduceMotion: !data.settings.reduceMotion })} />
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <Field label="Backspace rule">
                <select value={data.settings.backspaceMode} onChange={(event) => updateSettings({ backspaceMode: event.target.value })} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="allowed">Allowed</option>
                  <option value="errors-only">Only incorrect characters can be removed</option>
                  <option value="disabled">Disabled</option>
                </select>
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <SectionHeader icon={Clock3} title="Daily goal" description="Choose a target that you can repeat on ordinary days." />
            <div className="mt-6 grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((minutes) => (
                <button key={minutes} type="button" aria-pressed={data.settings.dailyGoalMinutes === minutes} onClick={() => updateSettings({ dailyGoalMinutes: minutes })} className={cn("rounded-xl border px-3 py-3 text-xs font-semibold transition", data.settings.dailyGoalMinutes === minutes ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")}>{minutes} min</button>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionHeader
              icon={user ? Cloud : HardDrive}
              title={user ? "Data and cloud sync" : "Guest data"}
              description={user ? "Every change is saved locally immediately and backed up automatically." : "Create an account to carry progress to another device."}
            />
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
              <div className="grid grid-cols-2 gap-4 text-center">
                <DataStat label="Sessions" value={data.progress.totalSessions} />
                <DataStat label="Saved attempts" value={data.attempts.length} />
                <DataStat label="Mastered / credited" value={`${course.masteredCount} / ${course.creditedCount}`} />
                <DataStat label="Custom texts" value={data.savedCustomTexts.length} />
              </div>
            </div>

            <details className="group mt-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                <span>
                  <span className="block text-sm font-semibold text-slate-950 dark:text-white">Advanced storage controls</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Usage details and history cleanup</span>
                </span>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  storageHealth.status === "error"
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    : storageHealth.warning
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                )}>
                  {storageHealth.status === "checking" ? "Checking" : storageHealth.status === "error" ? "Needs attention" : storageHealth.warning ? "High usage" : "Healthy"}
                </span>
              </summary>
              <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Detailed session records are stored separately from the compact progress summary used across the app.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <StorageStat label="Compact data" value={formatBytes(storageHealth.localBytes)} />
                  <StorageStat label="Detailed sessions" value={storageHealth.detailCount} />
                  <StorageStat label="Detail storage" value={formatBytes(storageHealth.detailBytes)} />
                  <StorageStat label="Browser usage" value={storageHealth.usage == null ? "Unavailable" : formatBytes(storageHealth.usage)} />
                </div>
                {storageHealth.error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-300">{storageHealth.error}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => refreshStorageHealth()}>Refresh usage</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await pruneHistory({ keep: 50 });
                        setMessage({ text: `${result.removed} old detailed session record${result.removed === 1 ? "" : "s"} removed. Compact history was preserved.`, tone: "success" });
                      } catch (error) {
                        setMessage({ text: error.message || "Old session details could not be pruned.", tone: "error" });
                      }
                    }}
                  >
                    Prune old details
                  </Button>
                </div>
              </div>
            </details>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" onClick={exportProgress}><Download className="size-4" />Export backup</Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" />Import backup</Button>
              <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
              {!user && (
                <Button as={Link} to="/account" variant="brand" className="sm:col-span-2">
                  <Cloud className="size-4" />Create account or sign in
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Export creates a complete JSON backup including available detailed session telemetry. {user ? `Automatic cloud backup: ${syncStatus}.${syncError ? ` ${syncError}` : ""}` : "Guest mode never requires the backend."}
            </p>
          </Card>

          <Card className="border-rose-200 p-5 sm:p-6 dark:border-rose-500/25">
            <SectionHeader
              icon={RotateCcw}
              title={user ? "Signed-in data is protected" : "Reset this device"}
              description={user ? "Sign out before deleting guest data. Cloud-account deletion will be added separately." : "Deletes every guest setting, attempt, lesson record, and saved text from this browser."}
              danger
            />
            <Button variant="danger" className="mt-6 w-full" onClick={handleReset} disabled={Boolean(user)}><RotateCcw className="size-4" />{user ? "Sign out to reset guest data" : "Delete all guest data"}</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}


function SectionHeader({ icon: Icon, title, description, danger = false }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", danger ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300")}><Icon className="size-5" /></span>
      <div><h2 className="font-semibold text-slate-950 dark:text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p></div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>{children}</label>;
}

function ThemeChoice({ icon: Icon, label, active, onClick }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold transition", active ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}><Icon className="size-4" />{label}</button>;
}

function SettingToggle({ icon: Icon, label, description, active, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={active} onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/60">
      {Icon && <Icon className="size-4 text-slate-400" />}
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-950 dark:text-white">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span></span>
      <span className={cn("h-6 w-11 shrink-0 rounded-full p-1 transition", active ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700")}><span className={cn("block size-4 rounded-full bg-white transition", active && "translate-x-5")} /></span>
    </button>
  );
}

function DataStat({ label, value }) {
  return <div><p className="text-xl font-semibold text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p></div>;
}

function StorageStat({ label, value }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60"><p className="font-semibold text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{label}</p></div>;
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
