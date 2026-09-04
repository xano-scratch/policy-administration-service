import { table, f } from "@xanots/sdk";
import { policies } from "./policies.js";

/**
 * A line of cover on a policy. The base premium is the sum over a policy's
 * coverages of `limit * rate_factor`, net of a deductible credit (a higher
 * deductible lowers the premium).
 */
export const coverages = table({
  name: "coverages",
  schema: {
    policy_id: f.tableRef(policies, { required: true }),
    kind: f.enum(["collision", "dwelling", "general_liability", "medical"], { required: true }),
    limit: f.decimal({ required: true, default: 0 }),
    deductible: f.decimal({ required: true, default: 0 }),
    rate_factor: f.decimal({ required: true, default: 0 }),
  },
});
