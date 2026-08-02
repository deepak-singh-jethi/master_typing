import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/authContext.js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase.js";
import { getPasswordResetRedirect, hasPasswordRecoveryParams } from "@/lib/authUrls.js";

function friendlyAuthError(error) {
  const message = error?.message || "Authentication failed.";
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email before signing in.";
  if (/user already registered/i.test(message)) return "An account already exists for this email.";
  if (/password should be at least|weak password/i.test(message)) return "Use a password with at least 8 characters.";
  if (/same password|different from the old password/i.test(message)) return "Choose a password you have not used for this account.";
  if (/email address not authorized/i.test(message)) return "This staging email service cannot send to that address. Use an approved tester email or configure custom SMTP.";
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(message)) return "Too many account emails were requested. Wait a few minutes and try again.";
  if (/failed to fetch|network/i.test(message)) return "Unable to reach the account service. Check your connection and try again.";
  return message;
}

async function requireSupabaseClient() {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [serviceError, setServiceError] = useState("");
  const [initializationAttempt, setInitializationAttempt] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    let unsubscribe = () => {};
    const recoveryRequested = typeof window !== "undefined" && hasPasswordRecoveryParams(window.location);
    if (recoveryRequested) setRecoveryMode(true);

    (async () => {
      try {
        const client = await requireSupabaseClient();
        if (!active) return;

        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!active) return;

        setSession(data.session ?? null);
        setServiceError("");
        setLoading(false);
        if (recoveryRequested && typeof window !== "undefined") {
          window.location.hash = "/reset-password";
        }

        const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
          if (!active) return;
          setSession(nextSession ?? null);
          setServiceError("");
          setLoading(false);
          if (event === "PASSWORD_RECOVERY") {
            setRecoveryMode(true);
            if (typeof window !== "undefined" && window.location.hash !== "#/reset-password") {
              window.location.hash = "/reset-password";
            }
          } else if (event === "SIGNED_OUT") {
            setRecoveryMode(false);
          }
        });

        unsubscribe = () => subscription.subscription.unsubscribe();
      } catch (error) {
        if (!active) return;
        setSession(null);
        setServiceError(friendlyAuthError(error));
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [initializationAttempt]);

  const retryService = useCallback(() => {
    setLoading(true);
    setServiceError("");
    setInitializationAttempt((value) => value + 1);
  }, []);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    try {
      const client = await requireSupabaseClient();
      const emailRedirectTo = typeof window === "undefined" ? undefined : getPasswordResetRedirect(window.location);
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName?.trim() || "Learner" },
          emailRedirectTo,
        },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    try {
      const client = await requireSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const client = await requireSupabaseClient();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      setSession(null);
      setRecoveryMode(false);
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    try {
      const client = await requireSupabaseClient();
      const redirectTo = getPasswordResetRedirect(window.location);
      const { data, error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const updatePassword = useCallback(async (password) => {
    try {
      if (!recoveryMode) throw new Error("This password-reset link is missing, expired, or has already been used.");
      const client = await requireSupabaseClient();
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setRecoveryMode(false);
      return data;
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, [recoveryMode]);

  const deleteAccount = useCallback(async ({ password, confirmation }) => {
    try {
      const client = await requireSupabaseClient();
      const currentEmail = session?.user?.email;
      if (!currentEmail) throw new Error("Sign in again before deleting this account.");
      if (confirmation !== "DELETE") throw new Error("Type DELETE exactly to confirm.");

      const { data: reauthenticated, error: signInError } = await client.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
      if (signInError) throw signInError;

      const accessToken = reauthenticated.session?.access_token;
      if (!accessToken) throw new Error("A fresh sign-in could not be verified. Try again.");
      const userId = reauthenticated.user?.id;
      const { error } = await client.functions.invoke("delete-account", {
        body: { confirmation: "DELETE", userId },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;

      await client.auth.signOut({ scope: "global" }).catch(() => undefined);
      setSession(null);
      return { userId };
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, [session?.user?.email]);

  const value = useMemo(() => ({
    configured: isSupabaseConfigured,
    loading,
    serviceError,
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user),
    recoveryMode,
    retryService,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    deleteAccount,
  }), [deleteAccount, loading, recoveryMode, retryService, sendPasswordReset, serviceError, session, signIn, signOut, signUp, updatePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
