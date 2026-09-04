import { apiGroup } from "@xanots/sdk";

// Pin each canonical slug so public paths are stable and getPath() resolves in
// the browser bundle from source alone.
export const authGroup = apiGroup({ name: "auth", canonical: "auth", description: "Sign in and mint a role-carrying token." });
export const policyGroup = apiGroup({ name: "policy", canonical: "policy", description: "The governed policy lifecycle." });
export const seedGroup = apiGroup({ name: "seed", canonical: "seed", description: "Load the demo book (ephemeral only)." });
