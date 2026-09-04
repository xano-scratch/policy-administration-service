import { query, input, s, ref, inp, c, expr, obj } from "@xanots/sdk";
import { policyGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policies } from "../tables/policies.js";
import { endorsements } from "../tables/endorsements.js";
import { policyEvents } from "../tables/policy_events.js";
import { requireUnderwriter } from "./guards.js";

/**
 * POST /api:policy/endorse — role underwriter.
 *
 * The derived-logic centerpiece. Only an `active` policy can be endorsed. A new
 * endorsement row is written, `current_premium` is recomputed by applying
 * `premium_delta`, and the history captures both the old and the new premium.
 */
export const endorseQuery = query({
  name: "endorse",
  verb: "POST",
  apiGroup: policyGroup,
  auth: users,
  input: {
    policy_id: input.int({ required: true }),
    kind: input.enum(["add_coverage", "remove_coverage", "change_limit", "change_deductible"], { required: true }),
    description: input.text({ required: true }),
    premium_delta: input.decimal({ required: true }),
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
      expr: expr(ref("pol.status"), "=", c.text("active")),
      error_type: "badrequest",
      error: c.text("Only an active policy can be endorsed."),
    }),
    // Recompute the premium deterministically: new = current + delta.
    s.set_var("new_premium", c.expression("$var.pol.current_premium + $input.premium_delta")),
    s.db.add({
      table: endorsements,
      row: {
        policy_id: inp("policy_id"),
        kind: inp("kind"),
        description: inp("description"),
        premium_delta: inp("premium_delta"),
        effective_date: c.now(),
        actor: ref("me.email"),
      },
      as: "endo",
    }),
    s.db.edit({
      table: policies,
      fieldName: "id",
      fieldValue: inp("policy_id"),
      row: { current_premium: ref("new_premium") },
      as: "updated",
    }),
    s.db.add({
      table: policyEvents,
      row: {
        policy_id: inp("policy_id"),
        event_type: "policy.endorsed",
        from_status: "active",
        to_status: "active",
        actor: ref("me.email"),
        detail: obj({
          kind: inp("kind"),
          description: inp("description"),
          old_premium: ref("pol.current_premium"),
          new_premium: ref("new_premium"),
        }),
      },
    }),
  ],
  response: {
    policy: ref("updated"),
    endorsement: ref("endo"),
    old_premium: ref("pol.current_premium"),
    new_premium: ref("new_premium"),
  },
});
