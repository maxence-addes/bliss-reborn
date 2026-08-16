import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Loader2,
  Sun,
  Moon,
  LogOut,
  Shield,
  Trash2,
  Palette,
  RefreshCw,
  LifeBuoy,
  ChevronRight,
  UserCog,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — Daily Rhythms" },
      {
        name: "description",
        content: "Thème, quiz, sécurité de la session et suppression du compte.",
      },
      { property: "og:title", content: "Paramètres — Daily Rhythms" },
      {
        property: "og:description",
        content: "Réglez l'apparence, la session et la confidentialité de votre compte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const deleteAccount = useServerFn(deleteMyAccount);

  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount({});
      await supabase.auth.signOut();
      toast.success("Compte supprimé");
      navigate({ to: "/login" });
    } catch (e) {
      console.error(e);
      toast.error("Impossible de supprimer le compte");
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const provider = (user?.app_metadata?.provider as string | undefined) ?? "email";
  const providerLabel = provider === "google" ? "Google" : "E-mail et mot de passe";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <h1 className="text-xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Réglages de l'application. Vos informations personnelles se modifient dans une
          page dédiée.
        </p>

        <Group label="Apparence">
          <ToggleRow
            icon={theme === "dark" ? Moon : Sun}
            title="Thème"
            subtitle={theme === "dark" ? "Sombre" : "Clair"}
            action={
              <Button size="sm" variant="outline" onClick={toggle} className="gap-2">
                <Palette className="w-4 h-4" />
                Basculer
              </Button>
            }
          />
        </Group>

        <Group label="Compte">
          <LinkRow
            icon={UserCog}
            title="Informations personnelles"
            subtitle="Nom, profil, codes d'invitation"
            onClick={() => navigate({ to: "/profile" })}
          />
          <LinkRow
            icon={RefreshCw}
            title="Refaire le quiz d'introduction"
            subtitle="Réajuster votre profil"
            onClick={() => navigate({ to: "/onboarding", search: { retake: 1 } })}
          />
          <LinkRow
            icon={LifeBuoy}
            title="Aide et support"
            subtitle="Questions fréquentes"
            onClick={() => navigate({ to: "/help" })}
          />
        </Group>

        <Group label="Sécurité de la session">
          <ToggleRow
            icon={KeyRound}
            title="Méthode de connexion"
            subtitle={providerLabel}
            action={<span className="text-xs text-muted-foreground">Actif</span>}
          />
          <ToggleRow
            icon={Shield}
            title="Session"
            subtitle="Se déconnecter de cet appareil"
            action={
              <Button size="sm" variant="outline" onClick={() => signOut()} className="gap-2">
                <LogOut className="w-4 h-4" /> Déconnexion
              </Button>
            }
          />
        </Group>

        <div className="mt-8 rounded-xl border border-destructive/30 bg-card overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-destructive border-b border-destructive/20">
            Zone dangereuse
          </p>
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium">Supprimer le compte</p>
            <p className="text-xs text-muted-foreground">
              Action définitive : habitudes, historique et profil seront effacés sans
              récupération possible.
            </p>
            <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="w-4 h-4" /> Supprimer mon compte
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Toutes vos données seront effacées immédiatement. Pour confirmer, tapez{" "}
                    <span className="font-mono font-semibold text-foreground">SUPPRIMER</span>{" "}
                    ci-dessous.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                  autoFocus
                />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== "SUPPRIMER" || deleting}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function LinkRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
    >
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
