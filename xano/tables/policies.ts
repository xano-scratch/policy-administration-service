import { table, f } from "@xanots/sdk";
import { policyholders } from "./policyholders.js";

/**
 * The lifecycle entity. `status` is the state machine the API layer enforces:
 * quoted -> bound -> active -> (renewed -> active) | cancelled. `base_premium`
 * is computed from the coverages at quote time; `current_premium` moves with
 * each endorsement.
 *
 * `effective_date` / `expiration_date` are stored as epoch-ms timestamps (not a
 * calendar date) so rolling a term forward is exact integer math. They are null
 * until the policy is bound.
 */
export const policies = table({
  name: "policies",
  schema: {
    policyholder_id: f.tableRef(policyholders, { required: true }),
    product: f.enum(["auto", "property", "liability"], { required: true }),
    status: f.enum(["quoted", "bound", "active", "renewed", "cancelled"], { required: true }),
    effective_date: f.timestamp({ nullable: true }),
    expiration_date: f.timestamp({ nullable: true }),
    base_premium: f.decimal({ required: true, default: 0 }),
    current_premium: f.decimal({ required: true, default: 0 }),
    term_months: f.int({ required: true, default: 12 }),
  },
});
