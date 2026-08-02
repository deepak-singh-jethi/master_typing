const viteEnvironment = import.meta.env ?? {};
const nodeEnvironment = typeof process !== "undefined" ? process.env ?? {} : {};

const supabaseUrl = String(
  viteEnvironment.VITE_SUPABASE_URL
    ?? nodeEnvironment.VITE_SUPABASE_URL
    ?? "",
).trim();

const supabaseKey = String(
  viteEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? nodeEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? "",
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let clientPromise = null;

/**
 * Load Supabase only when cloud features are actually configured and used.
 * This keeps Node-based unit tests independent of Vite's import.meta.env and
 * moves the Supabase SDK out of the application's initial browser bundle.
 */
export async function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;

  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) => createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }))
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }

  return clientPromise;
}
