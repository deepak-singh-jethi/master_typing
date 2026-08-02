function paramsFromHash(hash = "") {
  const clean = String(hash).replace(/^#/, "");
  if (!clean || clean.startsWith("/")) return new URLSearchParams();
  return new URLSearchParams(clean);
}

export function hasPasswordRecoveryParams(locationLike = {}) {
  const search = new URLSearchParams(String(locationLike.search || "").replace(/^\?/, ""));
  const hash = paramsFromHash(locationLike.hash);
  return search.get("type") === "recovery"
    || hash.get("type") === "recovery"
    || Boolean(search.get("code") && search.get("type") === "recovery");
}

export function getPasswordResetRedirect(locationLike = {}) {
  const origin = String(locationLike.origin || "").replace(/\/$/, "");
  const pathname = String(locationLike.pathname || "/") || "/";
  return `${origin}${pathname}`;
}
