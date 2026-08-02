import { useState } from "react";
import { Link } from "react-router-dom";
import { Cloud, Download, LogIn, LogOut, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { useApp } from "@/hooks/useApp.js";
import { useAuth } from "@/hooks/useAuth.js";

export function AccountPage() {
  const auth = useAuth();
  const { data, exportData, clearDeletedAccountData, syncStatus, syncError, syncNotice } = useApp();
  const [mode, setMode] = useState("signin");
  const [displayName, setDisplayName] = useState(data.profile.name || "Learner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [accountError, setAccountError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageTone("success");
    try {
      if (mode === "signup") {
        const result = await auth.signUp({ email, password, displayName });
        setMessage(result.session
          ? "Account created. Your local progress is being moved to the cloud."
          : "Account created. Check your email if confirmation is enabled in Supabase.");
      } else {
        await auth.signIn({ email, password });
        setMessage("Signed in. Your progress is synchronising.");
      }
    } catch (error) {
      setMessage(error.message);
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      setMessage("Enter your email first.");
      setMessageTone("error");
      return;
    }
    setBusy(true);
    try {
      await auth.sendPasswordReset(email);
      setMessage("Password reset email sent. Check your inbox.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error.message);
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setAccountError("");
    try {
      await auth.signOut();
    } catch (error) {
      setAccountError(error.message || "Unable to sign out. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const exportProgress = async () => {
    const backup = await exportData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `typing-master-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    const userId = auth.user?.id;
    if (!userId) return;
    setBusy(true);
    setAccountError("");
    try {
      await auth.deleteAccount({ password: deletePassword, confirmation: deleteConfirmation });
      await clearDeletedAccountData(userId);
      setShowDelete(false);
      setDeletePassword("");
      setDeleteConfirmation("");
    } catch (error) {
      setAccountError(error.message || "The account could not be deleted. No local data was removed.");
    } finally {
      setBusy(false);
    }
  };

  if (!auth.configured) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Account" title="Cloud sync is not configured" description="Guest practice still works normally on this device." />
        <Card className="max-w-2xl p-6">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the project’s .env.local file, then restart Vite.</p>
        </Card>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Account" title="Your progress is connected" description="Every change is saved locally first and backed up automatically." />
        <Card className="max-w-2xl p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><ShieldCheck className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-950 dark:text-white">{auth.user.email}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.progress.totalSessions} local sessions · {data.progress.completedLessons.length} completed lessons</p>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Cloud className="size-4" />
                <span>{syncStatus === "syncing" ? "Saving changes automatically…" : syncStatus === "synced" ? "Automatic backup is current" : syncStatus === "error" ? "Automatic backup will retry" : "Saved locally"}</span>
              </div>
              {syncNotice && <p role="status" aria-live="polite" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{syncNotice}</p>}
              {syncError && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">{syncError}</p>}
              {accountError && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">{accountError}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={signOut} disabled={busy}><LogOut className="size-4" />{busy ? "Please wait…" : "Sign out"}</Button>
            <Button variant="ghost" onClick={exportProgress} disabled={busy}><Download className="size-4" />Export progress</Button>
            <Button variant="ghost" className="text-rose-600 dark:text-rose-300" onClick={() => setShowDelete((value) => !value)} disabled={busy}><Trash2 className="size-4" />Delete account</Button>
          </div>
          {showDelete && (
            <form className="mt-6 space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/25 dark:bg-rose-500/10" onSubmit={deleteAccount}>
              <div>
                <h2 className="font-semibold text-rose-900 dark:text-rose-200">Permanently delete account and cloud progress</h2>
                <p className="mt-1 text-sm leading-6 text-rose-700 dark:text-rose-300">Export first if you want a copy. Deletion removes your profile, lessons, sessions, statistics, sync records, and account. It cannot be undone.</p>
              </div>
              <Field label="Current password"><input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} required className={inputClass} /></Field>
              <Field label="Type DELETE to confirm"><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} required className={inputClass} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="danger" disabled={busy || deleteConfirmation !== "DELETE"}><Trash2 className="size-4" />{busy ? "Deleting…" : "Delete permanently"}</Button>
                <Button variant="secondary" onClick={() => setShowDelete(false)} disabled={busy}>Cancel</Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Optional account" title="Keep practising as a guest or sync across devices" description="Creating an account moves the progress already stored in this browser into your private Supabase account." />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card className="p-6">
          <div role="group" aria-label="Account action" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
            <button type="button" aria-pressed={mode === "signin"} onClick={() => setMode("signin")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${mode === "signin" ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500"}`}>Sign in</button>
            <button type="button" aria-pressed={mode === "signup"} onClick={() => setMode("signup")} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${mode === "signup" ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500"}`}>Create account</button>
          </div>
          <form className="space-y-4" onSubmit={submit}>
            {mode === "signup" && <Field label="Display name"><input value={displayName} autoComplete="name" onChange={(e) => setDisplayName(e.target.value.slice(0, 40))} required className={inputClass} /></Field>}
            <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} /></Field>
            <Field label="Password"><input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} /></Field>
            <Button variant="brand" className="w-full" disabled={busy}>{mode === "signup" ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Button>
          </form>
          {mode === "signin" && <button type="button" onClick={forgotPassword} disabled={busy} className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-300">Forgot password?</button>}
          {message && <p role={messageTone === "error" ? "alert" : "status"} aria-live="polite" className={messageTone === "error" ? "mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"}>{message}</p>}
        </Card>
        <Card className="p-6">
          <Mail className="size-6 text-indigo-600" />
          <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">Guest mode remains available</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">You never need an account to practise. Guest progress stays in this browser. Signing in adds private cloud backup and cross-device recovery.</p>
          <Button as={Link} to="/" variant="secondary" className="mt-6">Continue as guest</Button>
        </Card>
      </div>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
function Field({ label, children }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>{children}</label>; }
