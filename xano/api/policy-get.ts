import { query, input, s, ref, inp, col, c, expr, obj } from "@xanots/sdk";
import { policyGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policies } from "../tables/policies.js";
import { policyholders } from "../tables/policyholders.js";
import { coverages } from "../tables/coverages.js";
import { endorsements } from "../tables/endorsements.js";
import { policyEvents } from "../tables/policy_events.js";

/**
 * GET /api:policy/get/{policy_id} — any signed-in role (viewer and up).
 *
 * The audit view: the policy joined with its policyholder, coverages,
 * endorsements, and the complete event history in order. The id rides the path
 * because this looks one row up by primary key.
 */
export const getPolicyQuery = query({
  name: "get/{policy_id}",
  verb: "GET",
  apiGroup: policyGroup,
  auth: users,
  input: { policy_id: input.int({ required: true }) },
  stack: [
    s.db.get_by_id({ table: policies, id: inp("policy_id"), as: "pol" }),
    s.precondition({
      expr: expr(ref("pol", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No such policy."),
    }),
    s.db.get_by_id({ table: policyholders, id: ref("pol.policyholder_id"), as: "holder" }),
    s.db.query({ table: coverages, where: expr(col("policy_id"), "=", inp("policy_id")), as: "covs" }),
    s.db.query({
      table: endorsements,
      where: expr(col("policy_id"), "=", inp("policy_id")),
      sort: [{ sortBy: "created_at", dir: "asc" }],
      as: "endos",
    }),
    s.db.query({
      table: policyEvents,
      where: expr(col("policy_id"), "=", inp("policy_id")),
      sort: [{ sortBy: "created_at", dir: "asc" }],
      as: "events",
    }),
  ],
  response: {
    policy: ref("pol"),
    policyholder: ref("holder"),
    coverages: ref("covs"),
    endorsements: ref("endos"),
    events: ref("events"),
  },
});
