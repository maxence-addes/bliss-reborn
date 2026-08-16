import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Daily Rhythms" },
      { name: "description", content: "Connectez-vous pour suivre vos habitudes quotidiennes." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/" });
        } else {
          setInfo("Vérifiez votre boîte mail pour confirmer votre adresse.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Connexion Google échouée.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="size-10 mx-auto mb-4 bg-brand-primary rounded-full ring-4 ring-brand-primary/10" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Bon retour" : "Créer un compte"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin"
              ? "Reprenez vos habitudes là où vous les avez laissées."
              : "Commencez à construire vos séries dès aujourd'hui."}
          </p>
        </div>

        <div className="bg-card ring-1 ring-border rounded-2xl p-6 space-y-4">
          <button
            onClick={google}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg ring-1 ring-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <GoogleIcon />
            Continuer avec Google
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full text-sm bg-muted/40 ring-1 ring-border rounded-lg px-3 py-2 outline-none focus:ring-brand-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm bg-muted/40 ring-1 ring-border rounded-lg px-3 py-2 outline-none focus:ring-brand-primary"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-xs text-foreground bg-muted/60 rounded-md px-3 py-2">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className={cn(
                "w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50",
              )}
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "signin" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="text-foreground font-medium hover:underline"
          >
            {mode === "signin" ? "Inscription" : "Connexion"}
          </button>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/" className="hover:underline">← Retour</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
