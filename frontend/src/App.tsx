import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Moon, Sun, LogOut, DatabaseZap, ShieldCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { LoginScreen } from "@/components/LoginScreen";
import { PolicyList } from "@/components/PolicyList";
import { PolicyDetail } from "@/components/PolicyDetail";
import { QuoteForm } from "@/components/QuoteForm";
import * as api from "@/lib/api";
import { ROLE_LABEL } from "@/lib/rbac";
import type { SessionUser } from "@/lib/api";

const USER_KEY = "pas.user";
type View = { name: "list" } | { name: "detail"; id: number } | { name: "quote" };

function readUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true,
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => (api.getToken() ? readUser() : null));
  const [view, setView] = useState<View>({ name: "list" });
  const [listKey, setListKey] = useState(0);
  const [reseeding, setReseeding] = useState(false);
  const { dark, toggle } = useDarkMode();

  function signOut() {
    api.setToken(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
    setView({ name: "list" });
  }

  // Sign out if the backend ever rejects the token.
  useEffect(() => {
    const handler = () => {
      toast.error("Your session expired. Please sign in again.");
      signOut();
    };
    api.onUnauthorized.add(handler);
    return () => {
      api.onUnauthorized.delete(handler);
    };
  }, []);

  function onLogin(result: api.LoginResult) {
    const u = api.sessionUserOf(result);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
    setUser(u);
    setView({ name: "list" });
    setListKey((k) => k + 1);
  }

  async function reseed() {
    setReseeding(true);
    try {
      await api.reseed();
      toast.success("Demo data reset.");
      setView({ name: "list" });
      setListKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the demo data.");
    } finally {
      setReseeding(false);
    }
  }

  if (!user) {
    return (
      <>
        <LoginScreen onLogin={onLogin} />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setView({ name: "list" })}
          >
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <ShieldCheck className="size-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Policy Administration</div>
              <div className="text-muted-foreground text-xs">Governed policy lifecycle</div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {ROLE_LABEL[user.role]} · {user.name}
            </Badge>
            <Button variant="ghost" size="icon" onClick={reseed} disabled={reseeding} title="Reset demo data">
              {reseeding ? <Loader2 className="animate-spin" /> : <DatabaseZap />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {view.name === "list" && (
          <PolicyList
            key={listKey}
            role={user.role}
            onOpen={(id) => setView({ name: "detail", id })}
            onNewQuote={() => setView({ name: "quote" })}
          />
        )}
        {view.name === "detail" && (
          <PolicyDetail id={view.id} role={user.role} onBack={() => setView({ name: "list" })} />
        )}
        {view.name === "quote" && (
          <QuoteForm
            onCancel={() => setView({ name: "list" })}
            onCreated={(id) => setView({ name: "detail", id })}
          />
        )}
      </main>

      <Toaster position="top-center" />
    </div>
  );
}
