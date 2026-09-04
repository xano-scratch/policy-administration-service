import { query, input, s, ref, inp, c, expr, obj } from "@xanots/sdk";
import { policyGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policies } from "../tables/policies.js";
import { policyEvents } from "../tables/policy_events.js";
import { requireUnderwriter } from "./guards.js";

/**
 * POST /api:policy/bind — role underwriter.
 *
 * Only a `quoted` policy can be bound. Binding moves it through bound to active,
 * stamps the term dates from `term_months`, and writes the transition to history.
 * An illegal source status is rejected at the API layer, not silently applied.
 */
export const bindQuery = query({
  name: "bind",
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
      expr: expr(ref("pol.status"), "=", c.text("quoted")),
      error_type: "badrequest",
      error: c.text("Only a quoted policy can be bound."),
    }),
    // Term dates as exact epoch-ms math: effective now, expiration one term out
    // (a month approximated as 2629800000 ms).
    s.set_var("eff", c.now()),
    s.set_var("exp", c.expression("$var.eff + $var.pol.term_months * 2629800000")),
    s.db.edit({
      table: policies,
      fieldName: "id",
      fieldValue: inp("policy_id"),
      row: { status: "active", effective_date: ref("eff"), expiration_date: ref("exp") },
      as: "updated",
    }),
    s.db.add({
      table: policyEvents,
      row: {
        policy_id: inp("policy_id"),
        event_type: "policy.bound",
        from_status: "quoted",
        to_status: "active",
        actor: ref("me.email"),
        detail: obj({ effective_date: ref("eff"), expiration_date: ref("exp") }),
      },
    }),
  ],
  response: { policy: ref("updated") },
});
