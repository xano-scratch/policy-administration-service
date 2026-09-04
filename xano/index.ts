import { workspace } from "@xanots/sdk";

import { users } from "./tables/users.js";
import { policyholders } from "./tables/policyholders.js";
import { policies } from "./tables/policies.js";
import { coverages } from "./tables/coverages.js";
import { endorsements } from "./tables/endorsements.js";
import { policyEvents } from "./tables/policy_events.js";

import { authGroup, policyGroup, seedGroup } from "./api/groups.js";

import { loginQuery } from "./api/auth-login.js";
import { quoteQuery } from "./api/policy-quote.js";
import { bindQuery } from "./api/policy-bind.js";
import { endorseQuery } from "./api/policy-endorse.js";
import { renewQuery } from "./api/policy-renew.js";
import { cancelQuery } from "./api/policy-cancel.js";
import { getPolicyQuery } from "./api/policy-get.js";
import { listPoliciesQuery } from "./api/policy-list.js";
import { seedRunQuery } from "./api/seed-run.js";

/**
 * policy-administration-service — a governed Xano backend for the insurance
 * policy lifecycle. One API layer decides what a valid policy change is:
 * an enforced quote / bind / endorse / renew / cancel state machine, premium
 * recomputed from coverages, API-layer RBAC, and an append-only audit history.
 */
export default workspace("policy-administration-service")
  .registerTables([users, policyholders, policies, coverages, endorsements, policyEvents])
  .registerApiGroups([authGroup, policyGroup, seedGroup])
  .registerQueries([
    loginQuery,
    quoteQuery,
    bindQuery,
    endorseQuery,
    renewQuery,
    cancelQuery,
    getPolicyQuery,
    listPoliciesQuery,
    seedRunQuery,
  ]);
