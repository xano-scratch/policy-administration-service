import { query, s, ref, c, obj } from "@xanots/sdk";
import type { Value } from "@xanots/sdk";
import { seedGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { policyholders } from "../tables/policyholders.js";
import { policies } from "../tables/policies.js";
import { coverages } from "../tables/coverages.js";
import { endorsements } from "../tables/endorsements.js";
import { policyEvents } from "../tables/policy_events.js";

// Small statement factories keep the demo book readable. Each returns one
// s.db.add — a single statement, so there is no stack-widening concern.
const coverage = (
  policyId: Value,
  kind: "collision" | "dwelling" | "general_liability" | "medical",
  limit: number,
  deductible: number,
  rate: number,
) =>
  s.db.add({
    table: coverages,
    row: { policy_id: policyId, kind, limit, deductible, rate_factor: rate },
  });

const event = (policyId: Value, type: string, from: Value | string, to: string, actor: string, detail: Value) =>
  s.db.add({
    table: policyEvents,
    row: { policy_id: policyId, event_type: type, from_status: from, to_status: to, actor, detail },
  });

const AGENT = "agent@demo.test";
const UW = "underwriter@demo.test";

/**
 * POST /api:seed/run — reset and load the demo book. Public so the frontend's
 * "Reset demo data" control works without a session; safe because it only ever
 * runs against a disposable ephemeral. Users are inserted in a fixed order, so
 * their ids (and therefore roles) are stable across resets and a token minted
 * before a reset still resolves to the same person.
 */
export const seedRunQuery = query({
  name: "run",
  verb: "POST",
  apiGroup: seedGroup,
  stack: [
    s.db.truncate({ table: policyEvents, reset: true }),
    s.db.truncate({ table: endorsements, reset: true }),
    s.db.truncate({ table: coverages, reset: true }),
    s.db.truncate({ table: policies, reset: true }),
    s.db.truncate({ table: policyholders, reset: true }),
    s.db.truncate({ table: users, reset: true }),

    // Time anchors (epoch-ms). A month is approximated as 2629800000 ms.
    s.set_var("now", c.now()),
    s.set_var("one_year", c.expression("$var.now + 12 * 2629800000")),
    s.set_var("near_expiry", c.expression("$var.now + 20 * 86400000")),
    s.set_var("p5_effective", c.expression("$var.now - 11 * 2629800000")),
    s.set_var("p3_effective", c.expression("$var.now - 60 * 86400000")),

    // Users — one per role. Fixed insert order → ids 1, 2, 3. Password hashes on write.
    s.db.add({ table: users, row: { email: AGENT, password: "demo1234", name: "Alex Agent", role: "agent" } }),
    s.db.add({ table: users, row: { email: UW, password: "demo1234", name: "Uma Underwriter", role: "underwriter" } }),
    s.db.add({ table: users, row: { email: "viewer@demo.test", password: "demo1234", name: "Vic Viewer", role: "viewer" } }),

    // Policyholders.
    s.db.add({ table: policyholders, row: { name: "Riverside Trucking", email: "ops@riverside.test", segment: "commercial" }, as: "h1" }),
    s.db.add({ table: policyholders, row: { name: "Dana Lopez", email: "dana.lopez@demo.test", segment: "personal" }, as: "h2" }),
    s.db.add({ table: policyholders, row: { name: "Northgate Apartments", email: "admin@northgate.test", segment: "commercial" }, as: "h3" }),

    // P1 — active auto policy. base = (50000*0.03 - 1000*0.05) + (20000*0.01 - 0) = 1450 + 200 = 1650.
    s.db.add({
      table: policies,
      row: {
        policyholder_id: ref("h1.id"), product: "auto", status: "active",
        effective_date: ref("now"), expiration_date: ref("one_year"),
        base_premium: 1650, current_premium: 1650, term_months: 12,
      },
      as: "p1",
    }),
    coverage(ref("p1.id"), "collision", 50000, 1000, 0.03),
    coverage(ref("p1.id"), "medical", 20000, 0, 0.01),
    event(ref("p1.id"), "policy.quoted", c.null(), "quoted", AGENT, obj({ base_premium: c.decimal(1650) })),
    event(ref("p1.id"), "policy.bound", "quoted", "active", UW, obj({ note: c.text("Bound and activated.") })),

    // P2 — active property policy, endorsed. base = (300000*0.003 - 2000*0.05) + (100000*0.002 - 500*0.05) = 800 + 175 = 975. +150 endorsement → 1125.
    s.db.add({
      table: policies,
      row: {
        policyholder_id: ref("h2.id"), product: "property", status: "active",
        effective_date: ref("now"), expiration_date: ref("one_year"),
        base_premium: 975, current_premium: 1125, term_months: 12,
      },
      as: "p2",
    }),
    coverage(ref("p2.id"), "dwelling", 300000, 2000, 0.003),
    coverage(ref("p2.id"), "general_liability", 100000, 500, 0.002),
    s.db.add({
      table: endorsements,
      row: {
        policy_id: ref("p2.id"), kind: "change_limit", description: "Raise dwelling limit to 350k",
        premium_delta: 150, effective_date: ref("now"), actor: UW,
      },
    }),
    event(ref("p2.id"), "policy.quoted", c.null(), "quoted", AGENT, obj({ base_premium: c.decimal(975) })),
    event(ref("p2.id"), "policy.bound", "quoted", "active", UW, obj({ note: c.text("Bound and activated.") })),
    event(ref("p2.id"), "policy.endorsed", "active", "active", UW, obj({
      kind: c.text("change_limit"), description: c.text("Raise dwelling limit to 350k"),
      old_premium: c.decimal(975), new_premium: c.decimal(1125),
    })),

    // P3 — cancelled liability policy. base = 250000*0.004 - 1000*0.05 = 1000 - 50 = 950.
    s.db.add({
      table: policies,
      row: {
        policyholder_id: ref("h3.id"), product: "liability", status: "cancelled",
        effective_date: ref("p3_effective"), expiration_date: ref("one_year"),
        base_premium: 950, current_premium: 950, term_months: 12,
      },
      as: "p3",
    }),
    coverage(ref("p3.id"), "general_liability", 250000, 1000, 0.004),
    event(ref("p3.id"), "policy.quoted", c.null(), "quoted", AGENT, obj({ base_premium: c.decimal(950) })),
    event(ref("p3.id"), "policy.bound", "quoted", "active", UW, obj({ note: c.text("Bound and activated.") })),
    event(ref("p3.id"), "policy.cancelled", "active", "cancelled", UW, obj({ reason: c.text("Non-renewal requested by the insured.") })),

    // P4 — freshly quoted auto policy (never bound). base = 40000*0.03 - 500*0.05 = 1200 - 25 = 1175.
    s.db.add({
      table: policies,
      row: {
        policyholder_id: ref("h1.id"), product: "auto", status: "quoted",
        base_premium: 1175, current_premium: 1175, term_months: 6,
      },
      as: "p4",
    }),
    coverage(ref("p4.id"), "collision", 40000, 500, 0.03),
    event(ref("p4.id"), "policy.quoted", c.null(), "quoted", AGENT, obj({ base_premium: c.decimal(1175) })),

    // P5 — active property policy near expiry, so renew works in the demo. base = 200000*0.003 - 1500*0.05 = 600 - 75 = 525.
    s.db.add({
      table: policies,
      row: {
        policyholder_id: ref("h2.id"), product: "property", status: "active",
        effective_date: ref("p5_effective"), expiration_date: ref("near_expiry"),
        base_premium: 525, current_premium: 525, term_months: 12,
      },
      as: "p5",
    }),
    coverage(ref("p5.id"), "dwelling", 200000, 1500, 0.003),
    event(ref("p5.id"), "policy.quoted", c.null(), "quoted", AGENT, obj({ base_premium: c.decimal(525) })),
    event(ref("p5.id"), "policy.bound", "quoted", "active", UW, obj({ note: c.text("Bound and activated.") })),
  ],
  response: { ok: c.bool(true) },
});
