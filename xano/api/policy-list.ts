import { query, input, s, ref, inp, col, cmp } from "@xanots/sdk";
import { policyGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policies } from "../tables/policies.js";

/**
 * GET /api:policy/list — any signed-in role (viewer and up).
 *
 * Lists policies with their status and current premium, newest first, optionally
 * filtered by status. `ignoreEmpty` drops the predicate when no status is given,
 * so an absent filter returns every policy.
 */
export const listPoliciesQuery = query({
  name: "list",
  verb: "GET",
  apiGroup: policyGroup,
  auth: users,
  input: {
    status: input.enum(["quoted", "bound", "active", "renewed", "cancelled"]),
  },
  stack: [
    s.db.query({
      table: policies,
      where: cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }),
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
