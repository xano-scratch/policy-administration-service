import { query, input, f, s, ref, inp, col, c, expr, obj, withFilters, fl } from "@xanots/sdk";
import { policyGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policyholders } from "../tables/policyholders.js";
import { policies } from "../tables/policies.js";
import { coverages } from "../tables/coverages.js";
import { policyEvents } from "../tables/policy_events.js";
import { requireAgentOrUnderwriter } from "./guards.js";

/**
 * POST /api:policy/quote — role agent or underwriter.
 *
 * Creates (or reuses) a policyholder, opens a policy in `quoted`, inserts its
 * coverages, and computes the base premium from the coverage rule. A quote must
 * carry at least one coverage. This is where the derived premium is first set.
 */
export const quoteQuery = query({
  name: "quote",
  verb: "POST",
  apiGroup: policyGroup,
  auth: users,
  input: {
    policyholder_name: input.text({ required: true }),
    policyholder_email: input.email({ required: true, methods: ["lower", "trim"] }),
    segment: input.enum(["personal", "commercial"], { required: true }),
    product: input.enum(["auto", "property", "liability"], { required: true }),
    term_months: input.int({ required: true, default: 12 }),
    coverages: input.list(
      input.object({
        kind: f.enum(["collision", "dwelling", "general_liability", "medical"]),
        limit: f.decimal(),
        deductible: f.decimal(),
        rate_factor: f.decimal(),
      }),
      { required: true },
    ),
  },
  stack: [
    ...requireAgentOrUnderwriter(),

    // A quote must carry at least one coverage.
    s.set_var("coverage_count", withFilters(inp("coverages"), fl.count())),
    s.precondition({
      expr: expr(ref("coverage_count"), ">", c.int(0)),
      error_type: "badrequest",
      error: c.text("A quote needs at least one coverage."),
    }),

    // Reuse a policyholder with this email, else create one. holder_id is set at
    // the top level so it types cleanly for the policy row below.
    s.db.get({ table: policyholders, fieldName: "email", fieldValue: inp("policyholder_email"), as: "existing_holder" }),
    s.set_var("holder_id", c.int(0)),
    s.conditional({
      when: expr(ref("existing_holder", { safe: true }), "!=", c.null()),
      then: [s.update_var("holder_id", ref("existing_holder.id"))],
      else: [
        s.db.add({
          table: policyholders,
          row: { name: inp("policyholder_name"), email: inp("policyholder_email"), segment: inp("segment") },
          as: "new_holder",
        }),
        s.update_var("holder_id", ref("new_holder.id")),
      ],
    }),

    // Base premium = sum over coverages of (limit * rate_factor), net of a
    // deductible credit, floored at zero. Reducing the list in one lambda call
    // beats a per-row loop (the body crosses the process boundary once).
    s.set_var(
      "base_premium",
      withFilters(
        inp("coverages"),
        fl.reduce({
          initial_value: 0,
          code: ({ $result, $this }: { $result: number; $this: { limit: number; rate_factor: number; deductible: number } }) =>
            $result + Math.max(0, $this.limit * $this.rate_factor - $this.deductible * 0.05),
        }),
      ),
    ),

    s.db.add({
      table: policies,
      row: {
        policyholder_id: ref("holder_id"),
        product: inp("product"),
        status: "quoted",
        base_premium: ref("base_premium"),
        current_premium: ref("base_premium"),
        term_months: inp("term_months"),
      },
      as: "policy",
    }),

    // Insert each coverage against the new policy.
    s.foreach({
      as: "cov",
      list: inp("coverages"),
      body: [
        s.db.add({
          table: coverages,
          row: {
            policy_id: ref("policy.id"),
            kind: ref("cov.kind"),
            limit: ref("cov.limit"),
            deductible: ref("cov.deductible"),
            rate_factor: ref("cov.rate_factor"),
          },
        }),
      ],
    }),

    // Audit: the quote was opened.
    s.db.add({
      table: policyEvents,
      row: {
        policy_id: ref("policy.id"),
        event_type: "policy.quoted",
        from_status: c.null(),
        to_status: "quoted",
        actor: ref("me.email"),
        detail: obj({ base_premium: ref("base_premium") }),
      },
    }),

    s.db.query({ table: coverages, where: expr(col("policy_id"), "=", ref("policy.id")), as: "policy_coverages" }),
  ],
  response: {
    policy: ref("policy"),
    coverages: ref("policy_coverages"),
  },
});
