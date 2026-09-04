import { table, f } from "@xanots/sdk";

/**
 * The auth table. `auth: true` lets `s.security.create_auth_token` mint tokens
 * for these rows and lets a `query({ auth: users })` refuse an unauthenticated
 * request before its stack runs. `role` drives API-layer RBAC (never row-level
 * security): each protected endpoint re-reads the caller's live role and guards.
 */
export const users = table({
  name: "users",
  auth: true,
  // `id` (int PK) + `created_at` (epochms) are auto-injected.
  schema: {
    email: f.email({ required: true }),
    password: f.password({ required: true }),
    name: f.text({ required: true }),
    role: f.enum(["agent", "underwriter", "viewer"], { required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
