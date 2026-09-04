import { table, f } from "@xanots/sdk";

/** The party a policy is written for. Reused across policies by email. */
export const policyholders = table({
  name: "policyholders",
  schema: {
    name: f.text({ required: true }),
    email: f.email({ required: true }),
    segment: f.enum(["personal", "commercial"], { required: true }),
  },
});
