export const ROBLOX_IDENTITY_COOKIE = "pf24_roblox_identity_v1";

export type RobloxIdentity = {
  userId: string;
  username: string;
  displayName: string;
  linkedAt: number;
};

type RobloxUsernameLookupResponse = {
  data?: Array<{
    id?: number | string;
    name?: string;
    displayName?: string;
  }>;
};

function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  const secret = authSecret();
  if (!secret) throw new Error("Missing AUTH_SECRET/NEXTAUTH_SECRET.");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function normalizeRobloxUsername(value: string) {
  return value.trim().replace(/^@/, "");
}

export async function resolveRobloxIdentity(usernameInput: string): Promise<RobloxIdentity> {
  const username = normalizeRobloxUsername(usernameInput);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    throw new Error("INVALID_USERNAME");
  }

  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ROBLOX_LOOKUP_${response.status}`);
  }

  const payload = await response.json() as RobloxUsernameLookupResponse;
  const user = payload.data?.[0];
  const userId = String(user?.id ?? "").trim();
  const canonicalUsername = String(user?.name ?? "").trim();
  const displayName = String(user?.displayName ?? canonicalUsername).trim();

  if (!userId || !canonicalUsername) throw new Error("ROBLOX_USER_NOT_FOUND");

  return {
    userId,
    username: canonicalUsername,
    displayName: displayName || canonicalUsername,
    linkedAt: Date.now(),
  };
}

export async function encodeRobloxIdentity(identity: RobloxIdentity) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(identity)));
  const key = await signingKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function decodeRobloxIdentity(value: string | null | undefined): Promise<RobloxIdentity | null> {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  try {
    const key = await signingKey();
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload),
    );
    if (!verified) return null;

    const decoded = new TextDecoder().decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(decoded) as Partial<RobloxIdentity>;
    const userId = String(parsed.userId ?? "").trim();
    const username = String(parsed.username ?? "").trim();
    const displayName = String(parsed.displayName ?? username).trim();
    const linkedAt = Number(parsed.linkedAt ?? 0);

    if (!userId || !/^[A-Za-z0-9_]{3,20}$/.test(username)) return null;

    return {
      userId,
      username,
      displayName: displayName || username,
      linkedAt: Number.isFinite(linkedAt) ? linkedAt : 0,
    };
  } catch {
    return null;
  }
}
