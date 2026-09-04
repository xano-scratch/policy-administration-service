import { query, input, s, ref, inp, c, expr, obj } from "@xanots/sdk";
import { policyGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policies } from "../tables/policies.js";
import { policyEvents } from "../tables/policy_events.js";
import { requireUnderwriter } from "./guards.js";

/**
 * POST /api:policy/renew — role underwriter.
 *
 * Only an active policy inside its renewal window (within 45 days of expiry) can
 * be renewed. Renewal rolls the term forward one period and keeps the policy
 * active. Renewing a policy that is not yet in its window is rejected.
 */
export const renewQuery = query({
  name: "renew",
  verb: "POST",
  apiGroup: policyGroup,
  auth: users,
  input: { policy_id: input.int({ required: true }) },
  stack: [
    ...requireUnderwriter(),
    s.db.get_by_id({ table: policies, id: inp("policy_id"), as: "pol" }),
    s.precondition({
      expr: expr(ref("pol", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No such policy."),
    }),
    s.precondition({
      expr: expr(ref("pol.status"), "=", c.text("active")),
      error_type: "badrequest",
      error: c.text("Only an active policy can be renewed."),
    }),
    s.precondition({
      expr: expr(ref("pol.expiration_date", { safe: true }), "!=", c.null()),
      error_type: "badrequest",
      error: c.text("This policy has no term to renew from."),
    }),
    // Renewal window: now within 45 days (3888000000 ms) of expiry.
    s.set_var("window_start", c.expression("$var.pol.expiration_date - 3888000000")),
    s.precondition({
      expr: expr(c.now(), ">=", ref("window_start")),
      error_type: "badrequest",
      error: c.text("This policy is not yet in its renewal window."),
    }),
    // Roll the term forward one period from the old expiry.
    s.set_var("new_exp", c.expression("$var.pol.expiration_date + $var.pol.term_months * 2629800000")),
    s.db.edit({
      table: policies,
      fieldName: "id",
      fieldValue: inp("policy_id"),
      row: { status: "active", effective_date: ref("pol.expiration_date"), expiration_date: ref("new_exp") },
      as: "updated",
    }),
    s.db.add({
      table: policyEvents,
      row: {
        policy_id: inp("policy_id"),
        event_type: "policy.renewed",
        from_status: "active",
        to_status: "active",
        actor: ref("me.email"),
        detail: obj({ new_effective_date: ref("pol.expiration_date"), new_expiration_date: ref("new_exp") }),
      },
    }),
  ],
  response: { policy: ref("updated") },
});
