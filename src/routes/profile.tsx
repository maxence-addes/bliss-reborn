import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  Mail,
  Calendar,
  Hash,
  Briefcase,
  GraduationCap,
  Target,
  BookOpen,
  Users,
  Baby,
  ListChecks,
  Copy,
  Check,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  levelForNow,
  levelsForNow,
  currentSchoolYear,
  schoolYearLabel,
} from "@/lib/school-levels";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Informations personnelles — Daily Rhythms" },
      {
        name: "description",
        content:
          "Consultez et modifiez votre identité, votre profil scolaire ou parental et vos codes d'invitation.",
      },
      { property: "og:title", content: "Informations personnelles — Daily Rhythms" },
      {
        property: "og:description",
        content: "Votre identité, votre profil et vos codes d'invitation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type ProfileMetadata = {
  grade?: string;
  studentGoal?: string;
  subjects?: string[];
  childCount?: string;
  childLevels?: string[];
  childLevelsYear?: number;
  gradeYear?: number;
  expectations?: string[];
};

type ProfileInfo = {
  display_name: string | null;
  profession: string | null;
  onboarded_at: string | null;
  created_at: string | null;
  invite_code: string | null;
  invite_codes: string[] | null;
  used_invite_codes: string[] | null;
  metadata: ProfileMetadata | null;
};

type ChildLink = { id: string; display_name: string | null };

const STUDENT_GOAL_LABELS: Record<string, string> = {
  organize: "Mieux organiser devoirs et révisions",
  habits: "Ancrer de bonnes habitudes",
  procrastinate: "Arrêter de procrastiner",
  reassure: "Rassurer mes parents",
};

const PARENT_EXPECTATION_LABELS: Record<string, string> = {
  notify: "Notification quand un devoir est terminé",
  planning: "Vue d'ensemble du planning",
  validate: "Valider le travail avant validation",
  habits: "Suivre la régularité des habitudes",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function professionLabel(p: string | null): string {
  if (!p) return "Non renseigné";
  if (p === "parent") return "Parent";
  if (p === "student") return "Étudiant";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function initials(name: string, email: string): string {
  const base = name.trim() || email.split("@")[0] || "?";
  return base
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [children, setChildren] = useState<ChildLink[]>([]);
  const [habitsCount, setHabitsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { count }, { data: kids }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "display_name, profession, onboarded_at, created_at, invite_code, invite_codes, used_invite_codes, metadata",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("habits")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase.rpc("get_my_children"),
      ]);
      if (cancelled) return;
      setDisplayName(prof?.display_name ?? "");
      setEmail(user.email ?? "");
      setProfile(
        prof ? { ...prof, metadata: (prof.metadata as ProfileMetadata | null) ?? null } : null,
      );
      setChildren((kids as ChildLink[] | null) ?? []);
      setHabitsCount(count ?? 0);
      setLoading(false);

      // Fait avancer les classes d'une année à chaque rentrée scolaire.
      const md = (prof?.metadata as ProfileMetadata | null) ?? null;
      const year = currentSchoolYear();
      if (md && md.childLevels?.length && md.childLevelsYear && md.childLevelsYear < year) {
        const updated = levelsForNow(md.childLevels, md.childLevelsYear);
        const nextMeta = { ...md, childLevels: updated, childLevelsYear: year };
        setProfile((prev) => (prev ? { ...prev, metadata: nextMeta } : prev));
        await supabase.from("profiles").update({ metadata: nextMeta }).eq("id", user.id);
      } else if (md && md.grade && md.gradeYear && md.gradeYear < year) {
        const nextMeta = { ...md, grade: levelForNow(md.grade, md.gradeYear), gradeYear: year };
        setProfile((prev) => (prev ? { ...prev, metadata: nextMeta } : prev));
        await supabase.from("profiles").update({ metadata: nextMeta }).eq("id", user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Impossible d'enregistrer");
      return;
    }
    toast.success("Informations mises à jour");
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copie impossible");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isStudent = profile?.profession === "student";
  const isParent = profile?.profession === "parent";
  const meta = profile?.metadata ?? {};
  const usedCodes = new Set(profile?.used_invite_codes ?? []);
  const allCodes =
    profile?.invite_codes && profile.invite_codes.length > 0
      ? profile.invite_codes
      : profile?.invite_code
        ? [profile.invite_code]
        : [];
  const availableCodes = allCodes.filter((c) => !usedCodes.has(c));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        {/* Carte identité */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {initials(displayName, email)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                {displayName || "Sans nom"}
              </h1>
              <p className="text-sm text-muted-foreground truncate">{email || "—"}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge icon={Briefcase}>{professionLabel(profile?.profession ?? null)}</Badge>
                <Badge icon={Calendar}>
                  Depuis {formatDate(profile?.created_at ?? user?.created_at ?? null)}
                </Badge>
                <Badge icon={ListChecks}>{habitsCount} habitudes</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Identité éditable */}
        <Block title="Identité" subtitle="Ce que les autres voient de vous.">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom affiché</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" value={email} disabled />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="gap-2 mt-4">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        </Block>

        {/* Profil détaillé */}
        <Block
          title={isParent ? "Profil parental" : "Profil scolaire"}
          subtitle="Issu de votre quiz d'introduction."
        >
          <dl className="divide-y divide-border">
            <Row icon={Calendar} label="Quiz complété le" value={formatDate(profile?.onboarded_at ?? null)} />
            {isStudent && meta.grade && (
              <Row
                icon={GraduationCap}
                label={`Classe (${schoolYearLabel()})`}
                value={levelForNow(meta.grade, meta.gradeYear)}
              />
            )}
            {isStudent && meta.studentGoal && (
              <Row
                icon={Target}
                label="Objectif principal"
                value={STUDENT_GOAL_LABELS[meta.studentGoal] ?? meta.studentGoal}
              />
            )}
            {isParent && meta.childCount && (
              <Row icon={Users} label="Nombre d'enfants" value={meta.childCount} />
            )}
            <Row icon={Mail} label="Contact" value={email || "—"} />
          </dl>

          {isStudent && meta.subjects && meta.subjects.length > 0 && (
            <Chips icon={BookOpen} title="Matières prioritaires" items={meta.subjects} />
          )}
          {isParent && meta.childLevels && meta.childLevels.length > 0 && (
            <>
              <Chips
                icon={Baby}
                title={`Classes des enfants — ${schoolYearLabel()}`}
                items={levelsForNow(meta.childLevels, meta.childLevelsYear)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Mise à jour automatique à chaque rentrée scolaire (août).
              </p>
            </>
          )}
          {isParent && meta.expectations && meta.expectations.length > 0 && (
            <Chips
              icon={ListChecks}
              title="Mes attentes"
              items={meta.expectations.map((e) => PARENT_EXPECTATION_LABELS[e] ?? e)}
            />
          )}
        </Block>

        {/* Liens & codes */}
        <Block title="Liens & codes" subtitle="Partagez un code pour lier un compte.">
          {isParent && children.length > 0 && (
            <Chips
              icon={UserIcon}
              title="Mes enfants liés"
              items={children.map((c) => c.display_name ?? "Sans nom")}
            />
          )}
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-4 mb-2">
            Codes d'invitation disponibles
          </p>
          <div className="flex flex-wrap gap-2">
            {availableCodes.map((code, i) => (
              <button
                key={i}
                onClick={() => copy(code)}
                className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-mono font-medium border border-border hover:border-primary/50 transition-colors"
              >
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                {code}
                {copied === code ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            ))}
            {availableCodes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun code disponible : tous vos codes ont déjà été utilisés.
              </p>
            )}
          </div>
        </Block>

        <p className="text-xs text-muted-foreground mt-8">
          Préférences, thème et sécurité se trouvent dans{" "}
          <button
            onClick={() => navigate({ to: "/settings" })}
            className="underline hover:text-foreground"
          >
            Paramètres
          </button>
          .
        </p>
      </div>
    </div>
  );
}

function Badge({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/70 border border-border px-3 py-1 text-xs font-medium">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      {children}
    </span>
  );
}

function Block({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-4 h-4" /> {label}
      </dt>
      <dd className="text-sm font-medium text-right truncate">{value}</dd>
    </div>
  );
}

function Chips({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-sm border border-border"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
