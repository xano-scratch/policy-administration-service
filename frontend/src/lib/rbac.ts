import type { Role } from "./api";

export type Action = "quote" | "bind" | "endorse" | "renew" | "cancel";

/**
 * The SAME rules the API enforces, mirrored here only to gate the UI (disable a
 * button the caller may not use). The server re-checks every one of these, so a
 * disabled control is a convenience, never the control itself.
 */
export function can(role: Role | undefined, action: Action): boolean {
  if (!role) return false;
  if (action === "quote") return role === "agent" || role === "underwriter";
  return role === "underwriter";
}

export const ROLE_CAPS: Record<Role, string> = {
  agent: "Create quotes and read policies.",
  underwriter: "Bind, endorse, renew, and cancel, plus everything an agent can do.",
  viewer: "Read policies and their full history.",
};

export const ROLE_LABEL: Record<Role, string> = {
  agent: "Agent",
  underwriter: "Underwriter",
  viewer: "Viewer",
};
