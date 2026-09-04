import { table, f } from "@xanots/sdk";
import { policies } from "./policies.js";

/**
 * Append-only audit history. Every state transition and every premium change
 * writes one row here, so the full story of a policy is readable in order.
 */
export const policyEvents = table({
  name: "policy_events",
  schema: {
    policy_id: f.tableRef(policies, { required: true }),
    event_type: f.text({ required: true }),
    from_status: f.text({ nullable: true }),
    to_status: f.text({ nullable: true }),
    actor: f.text({ required: true }),
    detail: f.json(),
  },
});
