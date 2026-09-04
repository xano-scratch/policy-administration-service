import { table, f } from "@xanots/sdk";
import { policies } from "./policies.js";

/** A mid-term change to an active policy. Applying one moves `current_premium` by `premium_delta`. */
export const endorsements = table({
  name: "endorsements",
  schema: {
    policy_id: f.tableRef(policies, { required: true }),
    kind: f.enum(["add_coverage", "remove_coverage", "change_limit", "change_deductible"], { required: true }),
    description: f.text({ required: true }),
    premium_delta: f.decimal({ required: true, default: 0 }),
    effective_date: f.timestamp({ nullable: true }),
    actor: f.text({ required: true }),
  },
});
