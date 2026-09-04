import { query, input, s, ref, inp, c, expr, obj } from "@xanots/sdk";
import { authGroup } from "./groups.js";
import { users } from "../tables/users.js";

/**
 * POST /api:auth/login — verify credentials and mint a role-carrying token.
 * Public (no `auth`). The submitted password is taken as text and passed straight
 * to check_password; taking it through input.password would double-hash it.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: authGroup,
  input: {
    email: input.email({ required: true, methods: ["lower", "trim"] }),
    password: input.text({ required: true }),
  },
  stack: [
    // `output` naming `password` is required — the column is access:"internal".
    s.db.get({
      table: users,
      fieldName: "email",
      fieldValue: inp("email"),
      output: ["id", "email", "name", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No account with that email."),
    }),
    s.security.check_password({ text_password: inp("password"), hash_password: ref("u.password"), as: "ok" }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error_type: "unauthorized",
      error: c.text("Wrong email or password."),
    }),
    s.security.create_auth_token({ table: users, id: ref("u.id"), extras: obj({ role: ref("u.role") }), as: "token" }),
  ],
  response: {
    token: ref("token"),
    user: obj({ id: ref("u.id"), email: ref("u.email"), name: ref("u.name"), role: ref("u.role") }),
  },
});
