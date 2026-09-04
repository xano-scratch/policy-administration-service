import { query, input, s, ref, inp, c, expr, obj } from "@xanots/sdk";
import { policyGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policies } from "../tables/policies.js";
import { policyEvents } from "../tables/policy_events.js";
import { requireUnderwriter } from "./guards.js";

/**
 * POST /api:policy/cancel — role underwriter.
 *
 * Cancels a policy and records the reason in the event detail. Cancelling an
 * already-cancelled policy is rejected.
 */
export const cancelQuery = query({
  name: "cancel",
  verb: "POST",
  apiGroup: policyGroup,
  auth: users,
  input: {
    policy_id: input.int({ required: true }),
    reason: input.text({ required: true }),
  },
  stack: [
    ...requireUnderwriter(),
    s.db.get_by_id({ table: policies, id: inp("policy_id"), as: "pol" }),
    s.precondition({
      expr: expr(ref("pol", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No such policy."),
    }),
    s.precondition({
      expr: expr(ref("pol.status"), "!=", c.text("cancelled")),
      error_type: "badrequest",
      error: c.text("This policy is already cancelled."),
    }),
    s.db.edit({
      table: policies,
      fieldName: "id",
      fieldValue: inp("policy_id"),
      row: { status: "cancelled" },
      as: "updated",
    }),
    s.db.add({
      table: policyEvents,
      row: {
        policy_id: inp("policy_id"),
        event_type: "policy.cancelled",
        from_status: ref("pol.status"),
        to_status: "cancelled",
        actor: ref("me.email"),
        detail: obj({ reason: inp("reason") }),
      },
    }),
  ],
  response: { policy: ref("updated") },
});
