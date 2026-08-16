import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, Copy, GraduationCap, Users, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { SCHOOL_LADDER, currentSchoolYear, schoolYearLabel } from "@/lib/school-levels";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Bienvenue — Daily Rhythms" },
      { name: "description", content: "Personnalisez votre expérience Daily Rhythms." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    retake: s.retake === 1 || s.retake === "1" ? 1 : undefined,
  }),
  component: OnboardingPage,
});

type Role = "student" | "parent";

const GRADES = [
  "Sixième",
  "Cinquième",
  "Quatrième",
  "Troisième",
  "Seconde",
  "Première",
  "Terminale",
  "Autre",
];

const STUDENT_GOALS = [
  { value: "organize", label: "📅 Mieux organiser mes devoirs et mes révisions" },
  { value: "habits", label: "🌱 Ancrer de bonnes habitudes (sport, lecture…)" },
  { value: "procrastinate", label: "⏱️ Arrêter de procrastiner" },
  { value: "reassure", label: "🤝 Rassurer mes parents avec mon avancée" },
];

const SUBJECTS = [
  "Mathématiques",
  "Français",
  "Histoire-Géographie",
  "Sciences (SVT/Physique)",
  "Anglais",
  "Espagnol",
  "Autre",
];

const CHILD_COUNT = ["1", "2", "3", "4+"];
const CHILD_LEVELS = SCHOOL_LADDER as readonly string[];
const PARENT_EXPECTATIONS = [
  { value: "notify", label: "🔔 Recevoir une notification quand un devoir est terminé" },
  { value: "planning", label: "📅 Avoir une vue d'ensemble sur son planning" },
  { value: "validate", label: "✅ Valider visuellement le travail avant qu'il soit marqué comme « fait »" },
  { value: "habits", label: "📊 Suivre la régularité de ses habitudes de vie" },
];

function generateCodeFallback() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { retake } = Route.useSearch();

  // Wizard state
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);

  // Student
  const [grade, setGrade] = useState<string>("");
  const [studentGoal, setStudentGoal] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);

  // Parent
  const [childCount, setChildCount] = useState<string | null>(null);
  const [childLevels, setChildLevels] = useState<string[]>([]);
  const [expectations, setExpectations] = useState<string[]>([]);

  // Linking
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCodes, setInviteCodes] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Async
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Skip if already onboarded
  useEffect(() => {
    if (!user) return;
    if (retake) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.onboarded_at) navigate({ to: "/" });
    })();
  }, [user, navigate, retake]);

  // Resume the quiz where it was left off (élève ayant choisi « Accéder à l'app »)
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`onboarding-progress:${user.id}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as { role?: Role; step?: number };
      if (saved.role) setRole(saved.role);
      if (saved.step && saved.step > 1) setStep(saved.step);
    } catch {}
  }, [user]);

  // Élève : rôle + code (2 étapes). Parent : rôle + 3 questions + invitation.
  const totalSteps = role === "student" ? 2 : 5;
  const progress = Math.min(100, Math.round((step / totalSteps) * 100));

  // Validation per step
  const canNext = useMemo(() => {
    if (step === 1) return role !== null;
    if (role === "student") {
      if (step === 2) return enteredCode.trim().length >= 4; // parent code
      if (step === 3) return grade !== "";
      if (step === 4) return studentGoal !== null;
      if (step === 5) return subjects.length > 0;
    }
    if (role === "parent") {
      if (step === 2) return childCount !== null;
      if (step === 3) return childLevels.length > 0;
      if (step === 4) return expectations.length > 0;
    }
    return true;
  }, [step, role, grade, studentGoal, subjects, childCount, childLevels, expectations, enteredCode]);

  const toggleInArray = (arr: string[], setter: (v: string[]) => void, value: string) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  // When entering step 5 as parent, ensure invite codes exist (one per child)
  useEffect(() => {
    if (step !== 5 || role !== "parent" || !user) return;
    (async () => {
      const n = childCount === "4+" ? 4 : Math.max(1, parseInt(childCount ?? "1", 10) || 1);
      const { data } = await supabase
        .from("profiles")
        .select("invite_code, invite_codes")
        .eq("id", user.id)
        .maybeSingle();

      const existing = new Set<string>();
      const existingArr = (data as { invite_codes?: string[] | null } | null)?.invite_codes ?? [];
      existingArr.forEach((c) => existing.add(c));
      if (data?.invite_code) existing.add(data.invite_code);

      const codes = Array.from(existing).slice(0, n);
      while (codes.length < n) {
        let c = generateCodeFallback();
        while (codes.includes(c)) c = generateCodeFallback();
        codes.push(c);
      }

      await supabase
        .from("profiles")
        .update({ invite_code: codes[0], invite_codes: codes })
        .eq("id", user.id);

      setInviteCode(codes[0]);
      setInviteCodes(codes);
    })();
  }, [step, role, user, childCount]);

  const copyCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCodeAt = async (idx: number) => {
    const code = inviteCodes[idx];
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 2000);
  };

  // Persist profile (called when finishing)
  const persistProfile = async () => {
    if (!user || !role) return false;
    const profession = role === "student" ? "eleve" : "parent";
    const metadata =
      role === "student"
        ? { grade, gradeYear: currentSchoolYear(), goal: studentGoal, subjects }
        : { childCount, childLevels, childLevelsYear: currentSchoolYear(), expectations };

    const { error } = await supabase
      .from("profiles")
      .update({
        role,
        profession,
        metadata,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
      return false;
    }
    if (role === "student") {
      try { localStorage.setItem(`student-mode-active:${user.id}`, "1"); } catch {}
    } else {
      try { localStorage.removeItem(`student-mode-active:${user.id}`); } catch {}
    }
    try { localStorage.removeItem(`onboarding-progress:${user.id}`); } catch {}
    return true;
  };

  // Student linking: enter parent's code — now at step 2, immediately after role selection
  const submitParentCode = async () => {
    if (!user || !enteredCode.trim()) return;
    setBusy(true);
    setError(null);
    setInfo(null);

    const code = enteredCode.trim().toUpperCase();
    const { data: found, error: findErr } = await supabase.rpc(
      "find_profile_by_invite_code",
      { _code: code },
    );
    if (findErr) {
      setError(findErr.message);
      setBusy(false);
      return;
    }
    const parent = Array.isArray(found) ? found[0] : found;
    if (!parent) {
      setError("Code invalide. Vérifiez avec votre parent.");
      setBusy(false);
      return;
    }
    if (parent.profession !== "parent") {
      setError("Ce code n'appartient pas à un compte parent.");
      setBusy(false);
      return;
    }

    // Create parent-child link immediately so we don't lose it
    const { error: insertErr } = await supabase
      .from("parent_child_links")
      .insert({ parent_user_id: parent.id, child_user_id: user.id });

    if (insertErr && insertErr.code !== "23505") {
      setError(insertErr.message);
      setBusy(false);
      return;
    }

    const ok = await persistProfile();
    if (ok) navigate({ to: "/" });
    else setBusy(false);
  };

  const finishStudent = async () => {
    setBusy(true);
    const ok = await persistProfile();
    if (ok) navigate({ to: "/" });
    else setBusy(false);
  };

  const finishParent = async () => {
    setBusy(true);
    const ok = await persistProfile();
    if (ok) navigate({ to: "/" });
    else setBusy(false);
  };

  // « Accéder à l'app » : on quitte l'espace élève sans terminer le quiz,
  // qui reprendra à l'étape 2 (saisie du code) la prochaine fois.
  const skipLinking = () => {
    setEnteredCode("");
    setError(null);
    if (user) {
      try {
        localStorage.setItem(
          `onboarding-progress:${user.id}`,
          JSON.stringify({ role: "student", step: 2 }),
        );
        localStorage.removeItem(`student-mode-active:${user.id}`);
        localStorage.removeItem(`student-mode-onboarded:${user.id}`);
      } catch {}
    }
    navigate({ to: "/" });
  };

  const goBack = () => {
    setError(null);
    setInfo(null);
    setStep((s) => Math.max(1, s - 1));
  };
  const goNext = () => {
    setError(null);
    setInfo(null);
    setStep((s) => s + 1);
  };

  // Quitter le quiz à tout moment : on mémorise l'avancement pour la prochaine fois.
  const quitQuiz = () => {
    if (user) {
      try {
        localStorage.setItem(
          `onboarding-progress:${user.id}`,
          JSON.stringify({ role, step }),
        );
      } catch {}
    }
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Étape {step} sur {totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-card ring-1 ring-border rounded-2xl p-6 transition-all">
          <div className="flex items-center justify-between mb-4">
            {step > 1 ? (
              <button
                onClick={goBack}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Retour
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={quitQuiz}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Quitter <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* STEP 1 — Role */}
          {step === 1 && (
            <div className="animate-in fade-in duration-300">
              <h1 className="text-xl font-semibold tracking-tight">
                Qui va utiliser ce compte ?
              </h1>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Cela nous permet d'adapter votre expérience.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RoleCard
                  selected={role === "student"}
                  onClick={() => setRole("student")}
                  icon={<GraduationCap className="w-6 h-6" />}
                  title="🚀 Je suis un Élève"
                />
                <RoleCard
                  selected={role === "parent"}
                  onClick={() => setRole("parent")}
                  icon={<Users className="w-6 h-6" />}
                  title="👨‍👩‍👦 Je suis un Parent"
                />
              </div>
              <button
                onClick={goNext}
                disabled={!canNext}
                className="mt-6 w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors disabled:opacity-50"
              >
                Continuer
              </button>
            </div>
          )}

          {/* STUDENT branch — ask parent code first, then collect info */}
          {role === "student" && step === 2 && (
            <StepWrapper
              title="Code de tes parents"
              subtitle="Demande le code à 6 caractères à ton parent pour lier vos comptes."
            >
              <input
                type="text"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                placeholder="EX: HA849X"
                maxLength={6}
                className="w-full text-center text-lg font-mono tracking-[0.3em] bg-muted/40 ring-1 ring-border rounded-lg px-3 py-3 outline-none focus:ring-brand-primary"
              />
              {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-3">
                  {error}
                </p>
              )}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={skipLinking}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg ring-1 ring-border text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  Accéder à l'app
                </button>
                <button
                  onClick={submitParentCode}
                  disabled={busy || enteredCode.trim().length < 4}
                  className="flex-1 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Valider le code
                </button>
              </div>
            </StepWrapper>
          )}

          {role === "student" && step === 3 && (
            <StepWrapper
              title="En quelle classe es-tu ?"
              subtitle="Sélectionne ton niveau scolaire."
            >
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full text-sm bg-muted/40 ring-1 ring-border rounded-lg px-3 py-2.5 outline-none focus:ring-brand-primary"
              >
                <option value="">— Choisir —</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <NextButton onClick={goNext} disabled={!canNext} />
            </StepWrapper>
          )}

          {role === "student" && step === 4 && (
            <StepWrapper
              title="Quel est ton objectif principal ?"
              subtitle="Choisis ce qui compte le plus pour toi."
            >
              <div className="space-y-2">
                {STUDENT_GOALS.map((opt) => (
                  <ChoiceButton
                    key={opt.value}
                    selected={studentGoal === opt.value}
                    onClick={() => setStudentGoal(opt.value)}
                    label={opt.label}
                  />
                ))}
              </div>
              <NextButton onClick={goNext} disabled={!canNext} />
            </StepWrapper>
          )}

          {role === "student" && step === 5 && (
            <StepWrapper
              title="Quelles sont les matières où tu as le plus de devoirs ?"
              subtitle="Sélectionne une ou plusieurs matières."
            >
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => {
                  const active = subjects.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleInArray(subjects, setSubjects, s)}
                      className={cn(
                        "text-sm px-3 py-1.5 rounded-full ring-1 transition-colors",
                        active
                          ? "ring-brand-primary bg-brand-primary/10 text-foreground"
                          : "ring-border bg-card hover:bg-muted/50",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={finishStudent}
                disabled={busy || subjects.length === 0}
                className="mt-6 w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Terminer l'inscription
              </button>
            </StepWrapper>
          )}

          {/* PARENT branch */}
          {role === "parent" && step === 2 && (
            <StepWrapper
              title="Combien d'enfants utiliseront l'app ?"
              subtitle="Vous pourrez générer un code d'invitation par enfant."
            >
              <div className="grid grid-cols-4 gap-2">
                {CHILD_COUNT.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChildCount(c)}
                    className={cn(
                      "py-3 rounded-lg ring-1 text-sm font-medium transition-colors",
                      childCount === c
                        ? "ring-brand-primary bg-brand-primary/10"
                        : "ring-border bg-card hover:bg-muted/50",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <NextButton onClick={goNext} disabled={!canNext} />
            </StepWrapper>
          )}

          {role === "parent" && step === 3 && (
            <StepWrapper
              title="En quelle classe sont vos enfants ?"
              subtitle={`Sélectionnez la classe précise pour l'année ${schoolYearLabel()}. Elle avancera automatiquement à chaque rentrée.`}
            >
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {CHILD_LEVELS.map((lvl) => (
                  <CheckBoxRow
                    key={lvl}
                    checked={childLevels.includes(lvl)}
                    onChange={() => toggleInArray(childLevels, setChildLevels, lvl)}
                    label={lvl}
                  />
                ))}
              </div>
              <NextButton onClick={goNext} disabled={!canNext} />
            </StepWrapper>
          )}

          {role === "parent" && step === 4 && (
            <StepWrapper
              title="Qu'attendez-vous de Daily Rhythms ?"
              subtitle="Choisissez une ou plusieurs attentes."
            >
              <div className="space-y-2">
                {PARENT_EXPECTATIONS.map((opt) => (
                  <CheckBoxRow
                    key={opt.value}
                    checked={expectations.includes(opt.value)}
                    onChange={() => toggleInArray(expectations, setExpectations, opt.value)}
                    label={opt.label}
                  />
                ))}
              </div>
              <NextButton onClick={goNext} disabled={!canNext} />
            </StepWrapper>
          )}

          {step === 5 && role === "parent" && (
            <StepWrapper
              title={inviteCodes.length > 1 ? "Invitez vos enfants" : "Invitez votre enfant"}
              subtitle={
                inviteCodes.length > 1
                  ? "Un code unique par enfant. Partagez chacun avec l'enfant correspondant."
                  : "Partagez ce code unique avec votre enfant pour lier vos comptes."
              }
            >
              {inviteCodes.length <= 1 ? (
                <div className="bg-muted/40 ring-1 ring-border rounded-xl p-5 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Votre code d'invitation
                  </p>
                  <p className="text-3xl font-mono font-semibold tracking-[0.3em]">
                    {inviteCode ?? "------"}
                  </p>
                  <button
                    onClick={copyCode}
                    disabled={!inviteCode}
                    className="mt-4 inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ring-1 ring-border hover:bg-card transition-colors disabled:opacity-50"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copié" : "Copier le code"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {inviteCodes.map((code, idx) => (
                    <div
                      key={code}
                      className="bg-muted/40 ring-1 ring-border rounded-xl p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Enfant {idx + 1}
                        </p>
                        <p className="text-xl font-mono font-semibold tracking-[0.25em]">
                          {code}
                        </p>
                      </div>
                      <button
                        onClick={() => copyCodeAt(idx)}
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ring-1 ring-border hover:bg-card transition-colors"
                      >
                        {copiedIdx === idx ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedIdx === idx ? "Copié" : "Copier"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-3">
                  {error}
                </p>
              )}
              <button
                onClick={finishParent}
                disabled={busy}
                className="mt-5 w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Accéder au tableau de bord
              </button>
            </StepWrapper>
          )}
        </div>
      </div>
    </div>
  );
}

function StepWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1 mb-5">{subtitle}</p>}
      {children}
    </div>
  );
}

function RoleCard({
  selected,
  onClick,
  icon,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-3 p-5 rounded-xl ring-1 text-left transition-all",
        selected
          ? "ring-brand-primary bg-brand-primary/10 scale-[1.01]"
          : "ring-border bg-card hover:bg-muted/50",
      )}
    >
      <span className={cn("p-2 rounded-lg", selected ? "bg-brand-primary/20 text-brand-primary" : "bg-muted/60 text-muted-foreground")}>
        {icon}
      </span>
      <span className="text-sm font-medium">{title}</span>
    </button>
  );
}

function ChoiceButton({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between text-sm px-4 py-3 rounded-lg ring-1 text-left transition-colors",
        selected
          ? "ring-brand-primary bg-brand-primary/10"
          : "ring-border bg-card hover:bg-muted/50",
      )}
    >
      <span>{label}</span>
      {selected && <Check className="w-4 h-4 text-brand-primary shrink-0 ml-2" />}
    </button>
  );
}

function CheckBoxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "w-full flex items-center gap-3 text-sm px-4 py-3 rounded-lg ring-1 text-left transition-colors",
        checked ? "ring-brand-primary bg-brand-primary/10" : "ring-border bg-card hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "size-4 rounded border flex items-center justify-center shrink-0",
          checked ? "bg-brand-primary border-brand-primary" : "border-border bg-card",
        )}
      >
        {checked && <Check className="w-3 h-3 text-background" />}
      </span>
      <span>{label}</span>
    </button>
  );
}

function NextButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-6 w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/80 transition-colors disabled:opacity-50"
    >
      Continuer
    </button>
  );
}
