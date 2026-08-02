import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function tokenIssuedAt(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Number(JSON.parse(atob(padded)).iat) || 0;
  } catch {
    return 0;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return response(401, { error: "Authentication required." });

  let body: { confirmation?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return response(400, { error: "Invalid request." });
  }
  if (body.confirmation !== "DELETE") return response(400, { error: "Deletion confirmation is required." });

  const issuedAt = tokenIssuedAt(token);
  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (!issuedAt || ageSeconds < 0 || ageSeconds > 5 * 60) {
    return response(401, { error: "Sign in again immediately before deleting the account." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return response(503, { error: "Account deletion is temporarily unavailable." });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user || body.userId !== user.id) {
    return response(401, { error: "The account could not be verified." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Account deletion failed", { userId: user.id, code: deleteError.code });
    return response(500, { error: "The account was not deleted. Try again later." });
  }

  return response(200, { deleted: true });
});
