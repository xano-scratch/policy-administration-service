// The one contract. Every path and every request/response type below is derived
// from the XanoTS query defs in ../../../xano — never hand-typed. Change a def
// and the client follows. None of these endpoints is stack-heavy (no agents), so
// importing the lean def values for getPath()/verb is safe.
import type { InferInput, InferResponse, InferRow } from "@xanots/sdk";
import type { users } from "../../../xano/tables/users.js";

import { loginQuery } from "../../../xano/api/auth-login.js";
import { quoteQuery } from "../../../xano/api/policy-quote.js";
import { bindQuery } from "../../../xano/api/policy-bind.js";
import { endorseQuery } from "../../../xano/api/policy-endorse.js";
import { renewQuery } from "../../../xano/api/policy-renew.js";
import { cancelQuery } from "../../../xano/api/policy-cancel.js";
import { getPolicyQuery } from "../../../xano/api/policy-get.js";
import { listPoliciesQuery } from "../../../xano/api/policy-list.js";
import { seedRunQuery } from "../../../xano/api/seed-run.js";

/**
 * The deployed backend base URL. Injected as window.XANO_HOST by
 * `xanots deploy --static`, or read from VITE_XANO_HOST in dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// ── Types derived from the defs ─────────────────────────────────────────────
export type LoginBody = InferInput<typeof loginQuery>;
export type LoginResult = InferResponse<typeof loginQuery>;

// Role is a fixed domain — derive it from the users table def, not the
// login response (whose fields widen to `| null` before the row is fetched).
export type Role = InferRow<typeof users>["role"];

/**
 * The session identity the UI carries. The login response types each field as
 * `| null` (the row could be absent before the precondition), so we narrow once
 * at the boundary — on a successful login the values are always present.
 */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
export function sessionUserOf(r: LoginResult): SessionUser {
  const u = r.user;
  return { id: Number(u.id), name: String(u.name ?? ""), email: String(u.email ?? ""), role: u.role as Role };
}

export type QuoteBody = InferInput<typeof quoteQuery>;
export type QuoteResult = InferResponse<typeof quoteQuery>;
export type CoverageInput = QuoteBody["coverages"][number];

export type EndorseBody = InferInput<typeof endorseQuery>;
export type CancelBody = InferInput<typeof cancelQuery>;

export type PolicyList = InferResponse<typeof listPoliciesQuery>;
export type Policy = PolicyList[number];
export type PolicyStatus = Policy["status"];

export type PolicyDetail = InferResponse<typeof getPolicyQuery>;
export type Policyholder = NonNullable<PolicyDetail["policyholder"]>;
export type Coverage = PolicyDetail["coverages"][number];
export type Endorsement = PolicyDetail["endorsements"][number];
export type PolicyEvent = PolicyDetail["events"][number];

// ── Token store (survives a reload) ─────────────────────────────────────────
const TOKEN_KEY = "pas.token";
let authToken: string | null = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export function setToken(token: string | null) {
  authToken = token;
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken(): string | null {
  return authToken;
}

// ── Transport ───────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fired when the backend rejects the token (401), so the app can sign out. */
export const onUnauthorized = new Set<() => void>();

async function request<T>(path: string, verb: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(XANO_HOST + path, {
    method: verb,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.message === "string") message = data.message;
    } catch {
      /* non-JSON body */
    }
    if (res.status === 401) onUnauthorized.forEach((fn) => fn());
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

// ── Typed endpoint wrappers ──────────────────────────────────────────────────
export function login(body: LoginBody): Promise<LoginResult> {
  return request(loginQuery.getPath(), loginQuery.verb, body);
}

export function listPolicies(status?: PolicyStatus): Promise<PolicyList> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(listPoliciesQuery.getPath() + qs, listPoliciesQuery.verb);
}

export function getPolicy(policyId: number): Promise<PolicyDetail> {
  return request(getPolicyQuery.getPath({ params: { policy_id: String(policyId) } }), getPolicyQuery.verb);
}

export function quote(body: QuoteBody): Promise<QuoteResult> {
  return request(quoteQuery.getPath(), quoteQuery.verb, body);
}

export function bind(policyId: number): Promise<{ policy: Policy }> {
  return request(bindQuery.getPath(), bindQuery.verb, { policy_id: policyId });
}

export function endorse(body: EndorseBody): Promise<InferResponse<typeof endorseQuery>> {
  return request(endorseQuery.getPath(), endorseQuery.verb, body);
}

export function renew(policyId: number): Promise<{ policy: Policy }> {
  return request(renewQuery.getPath(), renewQuery.verb, { policy_id: policyId });
}

export function cancel(body: CancelBody): Promise<{ policy: Policy }> {
  return request(cancelQuery.getPath(), cancelQuery.verb, body);
}

export function reseed(): Promise<InferResponse<typeof seedRunQuery>> {
  return request(seedRunQuery.getPath(), seedRunQuery.verb, {});
}
