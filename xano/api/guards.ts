import { s, ref, auth, c, expr, or, statements } from "@xanots/sdk";
import { users } from "../tables/users.js";

// API-layer RBAC. Each guard re-reads the CALLER'S LIVE ROW (never trusts a
// claim baked into the token) and enforces a role with s.precondition. Returned
// through statements() so the tuple survives the `...spread` into an endpoint's
// stack and InferResponse still resolves every downstream ref.
//
// Both guards bind `me` (the caller's row), so a stack that spreads one can read
// ref("me.email") / ref("me.role") afterwards.

/** Only an underwriter may bind, endorse, renew, or cancel. */
export function requireUnderwriter() {
  return statements(
    s.db.get_by_id({ table: users, id: auth("id"), as: "me" }),
    s.precondition({
      expr: expr(ref("me", { safe: true }), "!=", c.null()),
      error_type: "unauthorized",
      error: c.text("Your session is no longer valid. Sign in again."),
    }),
    s.precondition({
      expr: expr(ref("me.role"), "=", c.text("underwriter")),
      error_type: "accessdenied",
      error: c.text("Only an underwriter can perform this action."),
    }),
  );
}

/** An agent or an underwriter may quote; a viewer may not. */
export function requireAgentOrUnderwriter() {
  return statements(
    s.db.get_by_id({ table: users, id: auth("id"), as: "me" }),
    s.precondition({
      expr: expr(ref("me", { safe: true }), "!=", c.null()),
      error_type: "unauthorized",
      error: c.text("Your session is no longer valid. Sign in again."),
    }),
    s.precondition({
      expr: or(
        expr(ref("me.role"), "=", c.text("agent")),
        expr(ref("me.role"), "=", c.text("underwriter")),
      ),
      error_type: "accessdenied",
      error: c.text("A viewer cannot create quotes."),
    }),
  );
}
