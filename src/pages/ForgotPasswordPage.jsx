import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/hooks/useAuth";

export function ForgotPasswordPage() {
  const { configured, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!configured) {
      setIsError(true);
      setMessage("Cloud accounts are not configured.");
      return;
    }

    setBusy(true);
    setMessage("");
    setIsError(false);

    try {
      await sendPasswordReset(email);
      setMessage("If an account exists for this email, a password-reset link has been sent.");
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "Unable to send the reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPageFrame>
      <Card className="p-6 sm:p-8">
        <span className="grid size-11 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          <Mail className="size-5" />
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Reset your password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Enter the email used for your Typing Master account.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          {message && (
            <p
              role={isError ? "alert" : "status"}
              className={`rounded-2xl p-4 text-sm leading-6 ${
                isError
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {message}
            </p>
          )}
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>
            {busy && <RefreshCw className="size-4 animate-spin" />}
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <Link to="/account" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          <ArrowLeft className="size-4" />Back to sign in
        </Link>
      </Card>
    </AuthPageFrame>
  );
}

function AuthPageFrame({ children }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:py-12">
      <div className="mx-auto max-w-md">
        <Logo />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
