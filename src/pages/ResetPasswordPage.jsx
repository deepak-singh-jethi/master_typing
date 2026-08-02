import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth.js";

export function ResetPasswordPage() {
  const { loading, recoveryMode, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await updatePassword(password);
      setPassword("");
      setConfirmation("");
      setComplete(true);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center text-sm text-slate-500">Validating the recovery link…</div>;
  }

  if (complete) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Account recovery" title="Password updated" description="Your new password is active and this recovery link cannot be used again." />
        <Card className="max-w-xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
            <p role="status" className="text-sm leading-6 text-slate-600 dark:text-slate-300">You can continue to your account. If you are asked to sign in again, use the new password.</p>
          </div>
          <Button as={Link} to="/account" variant="brand" className="mt-5">Continue to account</Button>
        </Card>
      </div>
    );
  }

  if (!recoveryMode) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Account recovery" title="This recovery link is not active" description="The link may be expired, already used, or opened without the recovery token." />
        <Card className="max-w-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Request a new password-reset email and open the newest link in the same browser.</p>
          </div>
          <Button as={Link} to="/forgot-password" variant="brand" className="mt-5">Request a new link</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account recovery" title="Choose a new password" description="Use at least eight characters and enter it twice." />
      <Card className="max-w-xl p-6">
        <form onSubmit={submit} className="space-y-4">
          <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField label="Confirm new password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          <Button type="submit" variant="brand" disabled={busy}><KeyRound className="size-4" />{busy ? "Updating…" : "Update password"}</Button>
        </form>
        {message && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{message}</p>}
      </Card>
    </div>
  );
}

function PasswordField({ label, value, onChange, autoComplete }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="password"
        minLength={8}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}
