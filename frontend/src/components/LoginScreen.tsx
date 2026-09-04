import { useState } from "react";
import { toast } from "sonner";
import { Eye, ShieldCheck, UserPen, Loader2, ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { ROLE_CAPS, ROLE_LABEL } from "@/lib/rbac";
import type { Role } from "@/lib/api";

const DEMO: { role: Role; email: string; icon: typeof Eye }[] = [
  { role: "agent", email: "agent@demo.test", icon: UserPen },
  { role: "underwriter", email: "underwriter@demo.test", icon: ShieldCheck },
  { role: "viewer", email: "viewer@demo.test", icon: Eye },
];

export function LoginScreen({ onLogin }: { onLogin: (r: api.LoginResult) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function loginAs(email: string) {
    setBusy(email);
    try {
      let result: api.LoginResult;
      try {
        result = await api.login({ email, password: "demo1234" });
      } catch (e) {
        // A freshly deployed environment has no accounts yet. Load the demo
        // book once, then retry — so clone, deploy, open, pick a role just works.
        if (e instanceof api.ApiError && (e.status === 404 || e.status === 401)) {
          toast.info("Loading demo data…");
          await api.reseed();
          result = await api.login({ email, password: "demo1234" });
        } else {
          throw e;
        }
      }
      api.setToken(result.token);
      onLogin(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 p-6">
      <div className="space-y-3 text-center">
        <div className="text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <ShieldCheck className="size-3.5" /> Backend Modernization · Insurance
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Policy Administration Service</h1>
        <p className="text-muted-foreground mx-auto max-w-xl text-balance">
          A governed policy lifecycle in one API layer. Sign in as a role to see what it can do. The same rules are
          enforced by the backend, whichever role you pick.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {DEMO.map(({ role, email, icon: Icon }) => (
          <Card
            key={role}
            className="hover:border-primary/60 group cursor-pointer transition-colors"
            onClick={() => busy === null && loginAs(email)}
          >
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-semibold">{ROLE_LABEL[role]}</h2>
                <p className="text-muted-foreground text-sm">{ROLE_CAPS[role]}</p>
              </div>
              <Button variant="ghost" size="sm" className="mt-auto w-full justify-between px-2" disabled={busy !== null}>
                <span className="text-muted-foreground text-xs">{email}</span>
                {busy === email ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Demo accounts, password <code className="bg-muted rounded px-1.5 py-0.5">demo1234</code>. This is an ephemeral
        environment loaded with seed data.
      </p>
    </main>
  );
}
