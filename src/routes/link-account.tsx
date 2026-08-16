import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Check, Copy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/link-account")({
  head: () => ({
    meta: [
      { title: "Lier un compte — Daily Rhythms" },
      { name: "description", content: "Liez votre compte parent à celui de votre enfant." },
    ],
  }),
  component: LinkAccountPage,
});

function LinkAccountPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profession, setProfession] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [mode, setMode] = useState<"share" | "enter">("share");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Load profile + ensure invite_code
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("profession, invite_code")
        .eq("id", user.id)
        .maybeSingle();

      if (!data) return;
      // Only parents/élèves need linking
      if (data.profession !== "parent" && data.profession !== "eleve") {
        navigate({ to: "/" });
        return;
      }
      setProfession(data.profession);

      let code = data.invite_code as string | null;
      if (!code) {
        // Generate one
        code = generateCodeFallback();
        await supabase.from("profiles").update({ invite_code: code }).eq("id", user.id);
      }
      setInviteCode(code);
    })();
  }, [user, navigate]);

  const copyCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitCode = async () => {
    if (!user || !profession || !enteredCode.trim()) return;
    setBusy(true);
    setError(null);

    const code = enteredCode.trim().toUpperCase();

    const { data: found, error: findErr } = await supabase
      .rpc("find_profile_by_invite_code", { _code: code });

    if (findErr) {
      setError(findErr.message);
      setBusy(false);
      return;
    }
    const target = Array.isArray(found) ? found[0] : found;
    if (!target) {
      setError("Code introuvable. Vérifiez et réessayez.");
      setBusy(false);
      return;
    }
    if (target.id === user.id) {
      setError("Vous ne pouvez pas vous lier à vous-même.");
      setBusy(false);
      return;
    }

    // Determine parent / child based on professions
    let parentId: string;
    let childId: string;

    if (profession === "parent" && target.profession === "eleve") {
      parentId = user.id;
      childId = target.id;
    } else if (profession === "eleve" && target.profession === "parent") {
      parentId = target.id;
      childId = user.id;
    } else {
      setError(
        profession === "parent"
          ? "Ce code ne correspond pas à un compte élève."
          : "Ce code ne correspond pas à un compte parent.",
      );
      setBusy(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("parent_child_links")
      .insert({ parent_user_id: parentId, child_user_id: childId });

    if (insertErr) {
      // Unique violation = already linked
      if (insertErr.code === "23505") {
        await supabase.rpc("consume_invite_code", { _code: code });
        setSuccess(true);
        setBusy(false);
        setTimeout(() => navigate({ to: "/" }), 1500);
        return;
      }
      setError(insertErr.message);
      setBusy(false);
      return;
    }

    // Marque le code comme utilisé pour qu'il n'apparaisse plus dans la liste.
    await supabase.rpc("consume_invite_code", { _code: code });

    setSuccess(true);
    setBusy(false);
    setTimeout(() => navigate({ to: "/" }), 1500);
  };

  const skip = () => navigate({ to: "/" });

  if (loading || !profession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isParent = profession === "parent";
  const otherLabel = isParent ? "votre enfant" : "votre parent";
  const otherShort = isParent ? "enfant" : "parent";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="size-12 mx-auto mb-4 rounded-full bg-brand-primary/10 ring-1 ring-brand-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-brand-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Liez le compte de {otherLabel}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isParent
              ? "Connectez le compte de votre enfant pour suivre ses habitudes."
              : "Un parent doit se connecter à votre compte pour suivre vos habitudes."}
          </p>
        </div>

        <div className="bg-card ring-1 ring-border rounded-2xl p-6">
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 rounded-lg mb-5">
            <button
              onClick={() => setMode("share")}
              className={cn(
                "py-2 text-xs font-medium rounded-md transition-colors",
                mode === "share" ? "bg-card ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              Partager mon code
            </button>
            <button
              onClick={() => setMode("enter")}
              className={cn(
                "py-2 text-xs font-medium rounded-md transition-colors",
                mode === "enter" ? "bg-card ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              Entrer un code
            </button>
          </div>

          {mode === "share" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Donnez ce code à {otherLabel}. Il pourra l'entrer dans son application pour
                vous lier.
              </p>
              <div className="bg-muted/40 ring-1 ring-border rounded-lg p-5 text-center">
                <p className="text-3xl font-mono font-semibold tracking-[0.3em] text-foreground">
                  {inviteCode}
                </p>
              </div>
              <button
                onClick={copyCode}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg ring-1 ring-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copié" : "Copier le code"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Entrez le code à 6 caractères de {otherLabel}.
              </p>
              <input
                type="text"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="w-full text-center text-2xl font-mono tracking-[0.3em] bg-muted/40 ring-1 ring-border rounded-lg px-3 py-3 outline-none focus:ring-brand-primary uppercase"
              />
              <button
                onClick={submitCode}
                disabled={busy || enteredCode.length < 6}
                className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lier le compte
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-4">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-foreground bg-brand-primary/10 ring-1 ring-brand-primary/30 rounded-md px-3 py-2 mt-4 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" /> Compte {otherShort} lié avec succès.
            </p>
          )}
        </div>

        <button
          onClick={skip}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Passer pour l'instant
        </button>
      </div>
    </div>
  );
}

function generateCodeFallback() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
