import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getChildHabits,
  addChildHabit,
  deleteChildHabit,
} from "@/lib/child-habits.functions";
import {
  requestHabitApproval,
  listMyApprovals,
  listPendingApprovalsForParent,
  reviewHabitApproval,
} from "@/lib/habit-approvals.functions";
import { Sun, Moon, GraduationCap, LogOut, User as UserIcon, Settings, Shield, HelpCircle, Camera, Check, X, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const INSPIRATIONS: { image: string; quote: string }[] = [
  {
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1280&q=80",
    quote: "Les petites actions soutenues dans le temps se transforment en changements d'identité profonds.",
  },
  {
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1280&q=80",
    quote: "La discipline est le pont entre les objectifs et les accomplissements.",
  },
  {
    image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1280&q=80",
    quote: "Concentrez-vous sur la fréquence, pas sur l'intensité.",
  },
  {
    image: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1280&q=80",
    quote: "Un jour ou jour 1. C'est vous qui décidez.",
  },
  {
    image: "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1280&q=80",
    quote: "La motivation vous fait commencer, l'habitude vous fait continuer.",
  },
  {
    image: "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1280&q=80",
    quote: "Ce que vous faites chaque jour compte plus que ce que vous faites de temps en temps.",
  },
  {
    image: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1280&q=80",
    quote: "Le succès est la somme de petits efforts répétés jour après jour.",
  },
  {
    image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&q=80",
    quote: "Les habitudes sont l'intérêt composé du développement personnel.",
  },
  {
    image: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1280&q=80",
    quote: "Vous n'atteignez pas le niveau de vos objectifs, vous tombez au niveau de vos systèmes.",
  },
  {
    image: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1280&q=80",
    quote: "La constance bat l'intensité à chaque fois.",
  },
];
import {
  computeStreak,
  describeSchedule,
  getWeekDates,
  isScheduledOn,
  todayKey,
  type Habit,
  type Schedule,
} from "@/lib/habits";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { ChildStats } from "@/components/child-stats";
import { StreakFlame } from "@/components/streak-flame";

export const Route = createFileRoute("/")({
  component: Index,
});

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const WEEKDAY_PICKER = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "M" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

function Index() {
  const { theme, toggle } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [studentMode, setStudentMode] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [profession, setProfession] = useState<string | null>(null);
  const [children, setChildren] = useState<{ id: string; display_name: string | null }[]>([]);
  const [selectedChild, setSelectedChild] = useState<{ id: string; display_name: string | null } | null>(null);

  const fetchChildHabits = useServerFn(getChildHabits);
  const addChildHabitFn = useServerFn(addChildHabit);
  
  const deleteChildHabitFn = useServerFn(deleteChildHabit);
  const requestApprovalFn = useServerFn(requestHabitApproval);
  const listMyApprovalsFn = useServerFn(listMyApprovals);
  const listPendingApprovalsFn = useServerFn(listPendingApprovalsForParent);
  const reviewApprovalFn = useServerFn(reviewHabitApproval);

  // Pending approvals: child-side (habits awaiting parent review)
  const [myPendingHabitIds, setMyPendingHabitIds] = useState<Set<string>>(new Set());
  // Parent-side: pending approvals from linked children
  type PendingApproval = {
    id: string;
    habitId: string;
    habitName: string;
    childId: string;
    childName: string | null;
    date: string;
    imageUrl: string | null;
    imageUrls?: string[];
    createdAt: string;
  };
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingHabitForUploadRef = useRef<string | null>(null);
  const [uploadingHabitId, setUploadingHabitId] = useState<string | null>(null);

  // Parent viewing a child's space (espace élève)
  const viewingChild =
    studentMode && profession === "parent" ? selectedChild : null;

  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem(`student-mode-active:${user.id}`) === "1") {
        setStudentMode(true);
      }
    } catch {}
  }, [user]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [mounted, setMounted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [newScheduleType, setNewScheduleType] =
    useState<"daily" | "weekly" | "once" | "deadline">("daily");
  const [newWeekdays, setNewWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newDates, setNewDates] = useState<Date[]>([]);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    let cancelled = false;
    (async () => {
      // Load profile to know whether the quiz has already been completed.
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at, profession")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.profession) setProfession(profile.profession);
      if (profile?.onboarded_at) {
        setHasOnboarded(true);
        if (profile.profession !== "parent") {
          setStudentMode(true);
          try { localStorage.setItem(`student-mode-active:${user.id}`, "1"); } catch {}
        }
      }

      if (profile?.profession === "parent") {
        const { data: kids } = await supabase.rpc("get_my_children");
        if (!cancelled && kids) setChildren(kids as { id: string; display_name: string | null }[]);
      }

      setMounted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  // Load habits — either the current user's, or the selected child's (parent viewing espace élève)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      if (viewingChild) {
        try {
          const rows = await fetchChildHabits({ data: { childId: viewingChild.id } });
          if (cancelled) return;
          setHabits(
            (rows ?? []).map((h) => ({
              id: h.id,
              name: h.name,
              detail: h.detail,
              completions: h.completions ?? [],
              schedule: (h.schedule as Schedule) ?? { type: "daily" },
              createdBy: (h as { created_by?: string | null }).created_by ?? null,
            })),
          );
        } catch (e) {
          console.error(e);
          setHabits([]);
        }
        return;
      }
      const { data, error } = await supabase
        .from("habits")
        .select("id, name, detail, schedule, completions, created_by")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setHabits([]);
      } else {
        setHabits(
          (data ?? []).map((h) => ({
            id: h.id,
            name: h.name,
            detail: h.detail,
            completions: h.completions ?? [],
            schedule: (h.schedule as Schedule) ?? { type: "daily" },
            createdBy: (h as { created_by?: string | null }).created_by ?? null,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, viewingChild, fetchChildHabits]);

  // Load pending approvals (child sees their own; parent sees children's submissions)
  const refreshApprovals = useMemo(
    () => async () => {
      if (!user) return;
      try {
        if (profession === "parent" && studentMode) {
          const list = await listPendingApprovalsFn();
          setPendingApprovals(list as PendingApproval[]);
        } else {
          const mine = await listMyApprovalsFn();
          const today = todayKey();
          const ids = new Set<string>();
          for (const a of mine as Array<{ habit_id: string; date: string; status: string }>) {
            if (a.status === "pending" && a.date === today) ids.add(a.habit_id);
          }
          setMyPendingHabitIds(ids);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [user, profession, studentMode, listPendingApprovalsFn, listMyApprovalsFn],
  );
  useEffect(() => {
    void refreshApprovals();
  }, [refreshApprovals, habits]);






  const [inspoIndex, setInspoIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setInspoIndex((i) => (i + 1) % INSPIRATIONS.length);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeLabel = now
    ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "";

  const today = todayKey();
  const weekDates = useMemo(() => getWeekDates(), []);
  const todayIndex = weekDates.findIndex((d) => todayKey(d) === today);

  const toggleToday = async (id: string) => {
    if (viewingChild) return;
    const target = habits.find((h) => h.id === id);
    if (!target || !user) return;

    // Parent-given task: child must upload a proof image; do NOT directly toggle.
    const isParentGiven = !!target.createdBy && target.createdBy !== user.id;
    if (isParentGiven) {
      const done = target.completions.includes(today);
      if (done) return; // already validated by parent — can't un-check
      if (myPendingHabitIds.has(id)) return; // already awaiting approval
      pendingHabitForUploadRef.current = id;
      fileInputRef.current?.click();
      return;
    }

    const done = target.completions.includes(today);
    const nextCompletions = done
      ? target.completions.filter((c) => c !== today)
      : [...target.completions, today];
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, completions: nextCompletions } : h)),
    );
    try {
      const { error } = await supabase
        .from("habits")
        .update({ completions: nextCompletions })
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.error(e);
    }
  };

  const handleProofFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 10);
    const habitId = pendingHabitForUploadRef.current;
    e.target.value = "";
    pendingHabitForUploadRef.current = null;
    if (files.length === 0 || !habitId || !user) return;
    setUploadingHabitId(habitId);
    try {
      const imagePaths: string[] = [];
      for (const [i, file] of files.entries()) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${user.id}/${habitId}/${today}-${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("habit-proofs")
          .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
        if (upErr) throw upErr;
        imagePaths.push(path);
      }
      await requestApprovalFn({ data: { habitId, date: today, imagePaths } });
      setMyPendingHabitIds((prev) => new Set(prev).add(habitId));
    } catch (err) {
      console.error(err);
      alert("Échec de l'envoi de la preuve. Réessayez.");
    } finally {
      setUploadingHabitId(null);
    }
  };

  const handleReviewApproval = async (approvalId: string, approve: boolean) => {
    const approval = pendingApprovals.find((a) => a.id === approvalId);
    try {
      await reviewApprovalFn({ data: { approvalId, approve } });
      setPendingApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      // Approving a proof validates the task for that date: reflect it right away.
      if (approve && approval) {
        setHabits((prev) =>
          prev.map((h) =>
            h.id === approval.habitId && !h.completions.includes(approval.date)
              ? { ...h, completions: [...h.completions, approval.date] }
              : h,
          ),
        );
        setMyPendingHabitIds((prev) => {
          const next = new Set(prev);
          next.delete(approval.habitId);
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };


  const removeHabit = async (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    try {
      if (viewingChild) {
        await deleteChildHabitFn({ data: { habitId: id } });
      } else {
        const { error } = await supabase.from("habits").delete().eq("id", id);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addHabit = async () => {
    if (!newName.trim() || !user) return;

    let schedule: Schedule = { type: "daily" };
    if (newScheduleType === "weekly") {
      schedule = { type: "weekly", weekdays: newWeekdays };
    } else if (newScheduleType === "once") {
      schedule = { type: "once", dates: newDates.map((d) => todayKey(d)) };
    } else if (newScheduleType === "deadline") {
      if (!newDueDate) return;
      schedule = { type: "deadline", dueDate: todayKey(newDueDate) };
    }
    const detail = newDetail.trim() || "Quotidien";
    const name = newName.trim();
    let data: { id: string; name: string; detail: string; schedule: unknown; completions: string[] | null; created_by?: string | null } | null = null;
    try {
      if (viewingChild) {
        data = await addChildHabitFn({
          data: { childId: viewingChild.id, name, detail, schedule },
        });
      } else {
        const res = await supabase
          .from("habits")
          .insert({
            user_id: user.id,
            name,
            detail,
            schedule: schedule as unknown as never,
            completions: [],
            created_by: user.id,
          })
          .select("id, name, detail, schedule, completions, created_by")
          .single();
        if (res.error) throw res.error;
        data = res.data;
      }
    } catch (e) {
      console.error(e);
      return;
    }
    if (!data) return;

    setHabits((prev) => [
      ...prev,
      {
        id: data.id,
        name: data.name,
        detail: data.detail,
        completions: data.completions ?? [],
        schedule: (data.schedule as Schedule) ?? schedule,
        createdBy: data.created_by ?? null,
      },
    ]);
    setNewName("");
    setNewDetail("");
    setNewScheduleType("daily");
    setNewWeekdays([1, 2, 3, 4, 5]);
    setNewDates([]);
    setNewDueDate(undefined);
    setAdding(false);
  };



  // Week completion based on scheduled habits per day
  // Deadline habits ne comptent que le jour J (jour de l'échéance)
  const isCountedOn = (h: Habit, d: Date) => {
    if (!isScheduledOn(h, d)) return false;
    if (h.schedule.type === "deadline") return h.schedule.dueDate === todayKey(d);
    return true;
  };
  const weekDoneFlags = weekDates.map((d) => {
    const key = todayKey(d);
    const scheduled = habits.filter((h) => isCountedOn(h, d));
    return (
      scheduled.length > 0 && scheduled.every((h) => h.completions.includes(key))
    );
  });
  const weekAnyFlags = weekDates.map((d) => {
    const key = todayKey(d);
    return habits.some(
      (h) => isCountedOn(h, d) && h.completions.includes(key),
    );
  });

  const completionPct = (() => {
    let total = 0;
    let done = 0;
    weekDates.forEach((d) => {
      const key = todayKey(d);
      habits.forEach((h) => {
        if (!isScheduledOn(h, d)) return;
        total += 1;
        if (h.completions.includes(key)) done += 1;
      });
    });
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  })();

  // Échéance complétée un jour précédent => on la masque (le jour de la coche, on l'affiche encore)
  const isDeadlineDoneEarly = (h: Habit) =>
    h.schedule.type === "deadline" &&
    h.completions.length > 0 &&
    h.completions.every((c) => c < today);

  const todaysHabits = habits.filter(
    (h) => isScheduledOn(h, new Date()) && !isDeadlineDoneEarly(h),
  );
  const upcomingHabits = habits.filter(
    (h) => !isScheduledOn(h, new Date()) && !isDeadlineDoneEarly(h),
  );
  const parentGivenTodos = !viewingChild && user
    ? todaysHabits.filter(
        (h) => h.createdBy && h.createdBy !== user.id && !h.completions.includes(today),
      )
    : [];

  const bestStreak = habits.reduce((m, h) => Math.max(m, computeStreak(h.completions)), 0);

  const dateLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-brand-primary/10">
      <header className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium capitalize">
                {dateLabel}{timeLabel && ` · ${timeLabel}`}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                {studentMode
                  ? profession === "parent"
                    ? "Mon espace parent"
                    : "Mon espace enfant"
                  : "Mes projets"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {!studentMode && (
                <div className="flex items-center gap-2 bg-muted/80 ring-1 ring-border px-3 py-1.5 rounded-full">
                  <StreakFlame streak={bestStreak} size={16} />
                  <span className="text-sm font-medium">
                    Série de {bestStreak} {bestStreak > 1 ? "jours" : "jour"}
                  </span>
                </div>
              )}
              <button
                onClick={() => {
                  const next = !studentMode;

                  setStudentMode(next);
                  if (user) {
                    try {
                      if (next) localStorage.setItem(`student-mode-active:${user.id}`, "1");
                      else localStorage.removeItem(`student-mode-active:${user.id}`);
                    } catch {}
                  }
                  if (!next) {
                    setSelectedChild(null);
                  }
                  // Only students get the onboarding quiz on first toggle; parents skip it.
                  if (next && user && profession !== "parent") {
                    const key = `student-mode-onboarded:${user.id}`;
                    if (!localStorage.getItem(key)) {
                      localStorage.setItem(key, "1");
                      navigate({ to: "/onboarding", search: { retake: 1 } as never });
                    }
                  }
                }}
                aria-label={studentMode ? "Quitter l'espace élève" : "Passer en espace élève"}
                className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-muted ring-1 ring-border"
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-card shadow transition-transform",
                    studentMode ? "translate-x-6" : "translate-x-1"
                  )}
                >
                  <GraduationCap className={cn("w-3 h-3", studentMode ? "text-brand-primary" : "text-muted-foreground")} />
                </span>
              </button>
              <button
                onClick={toggle}
                aria-label={theme === "dark" ? "Passer en mode jour" : "Passer en mode nuit"}
                className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background bg-muted ring-1 ring-border"
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-card shadow transition-transform",
                    theme === "dark" ? "translate-x-6" : "translate-x-1"
                  )}
                >
                  {theme === "dark" ? (
                    <Moon className="w-3 h-3 text-foreground" />
                  ) : (
                    <Sun className="w-3 h-3 text-brand-primary" />
                  )}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Mon compte"
                    title={user?.email ?? "Mon compte"}
                    className="inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform hover:scale-105"
                  >
                    <Avatar className="size-8 ring-1 ring-border">
                      <AvatarFallback className="bg-brand-primary text-primary-foreground text-xs font-medium">
                        {(user?.email ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
                  <div className="flex flex-col items-center gap-2 px-4 py-5 bg-muted/40">
                    <Avatar className="size-16 ring-2 ring-background">
                      <AvatarFallback className="bg-brand-primary text-primary-foreground text-xl font-medium">
                        {(user?.email ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <div className="text-sm font-medium text-foreground">
                        Bonjour {user?.email?.split("@")[0] ?? ""}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[15rem]">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="m-0" />
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-3 pt-2 pb-1">
                    Compte
                  </DropdownMenuLabel>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate({ to: "/profile" })}>
                    <UserIcon className="w-4 h-4" /> Informations personnelles
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate({ to: "/link-account" })}>
                    <Shield className="w-4 h-4" /> Liaison de comptes
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={toggle}>
                    {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {theme === "dark" ? "Mode jour" : "Mode nuit"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate({ to: "/settings" })}>
                    <Settings className="w-4 h-4" /> Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate({ to: "/help" })}>
                    <HelpCircle className="w-4 h-4" /> Aide
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => signOut()}
                  >
                    <LogOut className="w-4 h-4" /> Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {!(profession === "parent" && studentMode && !selectedChild) && (
            <div className="bg-muted/40 ring-1 ring-border rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-medium text-muted-foreground">Progression hebdomadaire</h2>
                <span className="text-sm font-medium text-brand-muted">{completionPct}% complété</span>
              </div>
              <div className="grid grid-cols-7 gap-3">
                {weekDates.map((d, i) => {
                  const isToday = i === todayIndex;
                  const allDone = weekDoneFlags[i];
                  const anyDone = weekAnyFlags[i];
                  return (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          isToday ? "text-brand-primary" : "text-muted-foreground"
                        )}
                      >
                        {DAY_LABELS[i]}
                      </span>
                      <div
                        className={cn(
                          "size-8 rounded-full flex items-center justify-center transition-all",
                          allDone
                            ? "bg-brand-primary"
                            : isToday
                              ? "ring-1 ring-brand-primary ring-offset-2"
                              : anyDone
                                ? "bg-brand-primary/20"
                                : "bg-muted/50"
                        )}
                      >
                        {anyDone && !allDone && (
                          <div className="size-2 bg-brand-primary rounded-full" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hidden file input used by child to upload proof of work */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleProofFileSelected}
      />

      {(() => {
        if (!(profession === "parent" && studentMode && selectedChild)) return null;
        const childApprovals = pendingApprovals.filter((a) => a.childId === selectedChild.id);
        if (childApprovals.length === 0) return null;
        return (
          <section className="py-0 px-6 mb-6">
            <div className="max-w-2xl mx-auto space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Travaux à valider ({childApprovals.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {childApprovals.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-card ring-1 ring-border rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{a.habitName}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.childName ?? "Enfant"} · {a.date}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const urls =
                        a.imageUrls && a.imageUrls.length > 0
                          ? a.imageUrls
                          : a.imageUrl
                            ? [a.imageUrl]
                            : [];
                      if (urls.length === 0) {
                        return (
                          <p className="text-xs text-muted-foreground">Image indisponible.</p>
                        );
                      }
                      return (
                        <div
                          className={cn(
                            "grid gap-2",
                            urls.length === 1 ? "grid-cols-1" : "grid-cols-2",
                          )}
                        >
                          {urls.map((url, i) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                src={url}
                                alt={`Preuve ${i + 1} pour ${a.habitName}`}
                                className="w-full max-h-72 object-contain rounded-lg bg-muted/40 ring-1 ring-border"
                              />
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                    {a.imageUrls && a.imageUrls.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {a.imageUrls.length} images envoyées
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewApproval(a.id, true)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md bg-brand-primary text-white hover:opacity-90 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Approuver
                      </button>
                      <button
                        onClick={() => handleReviewApproval(a.id, false)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md ring-1 ring-border text-foreground hover:bg-muted cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {profession === "parent" && studentMode && (
        <section className="py-0 px-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {selectedChild
                  ? `Espace de ${selectedChild.display_name ?? "votre enfant"}`
                  : "Mes enfants"}
              </h2>
              {selectedChild && (
                <button
                  onClick={() => {
                    setSelectedChild(null);
                    setAdding(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Tous mes enfants
                </button>
              )}
            </div>

            {children.length === 0 ? (
              <div className="p-6 bg-card ring-1 ring-border rounded-xl text-center space-y-3">
                <p className="text-sm font-medium">Aucun enfant lié pour le moment.</p>
                <p className="text-xs text-muted-foreground">
                  Liez le compte de votre enfant pour suivre ses devoirs, tâches et échéances.
                </p>
                <button
                  onClick={() => navigate({ to: "/link-account" })}
                  className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-brand-primary text-white hover:opacity-90"
                >
                  Lier un compte enfant
                </button>
              </div>
            ) : !selectedChild ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedChild(c);
                      setAdding(false);
                      setNewDetail("");
                    }}
                    className="text-left p-4 bg-card ring-1 ring-border rounded-xl hover:-translate-y-px hover:ring-brand-primary transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 ring-1 ring-border">
                        <AvatarFallback className="bg-brand-primary text-primary-foreground text-sm font-medium">
                          {(c.display_name ?? "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{c.display_name ?? "Enfant"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Voir et ajouter devoirs, tâches, échéances
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {viewingChild && (() => {
        const childApprovals = pendingApprovals.filter((a) => a.childId === viewingChild.id);
        const activeHabits = habits.length;
        const totalCompletions = habits.reduce((sum, h) => sum + h.completions.length, 0);
        const bestChildStreak = habits.reduce(
          (m, h) => Math.max(m, computeStreak(h.completions)),
          0,
        );
        // Weekly completion %
        let weekTotal = 0;
        let weekDone = 0;
        weekDates.forEach((d) => {
          const key = todayKey(d);
          habits.forEach((h) => {
            if (!isScheduledOn(h, d)) return;
            weekTotal += 1;
            if (h.completions.includes(key)) weekDone += 1;
          });
        });
        const weekPct = weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100);

        const doneToday = habits.filter(
          (h) => isScheduledOn(h, new Date()) && h.completions.includes(today),
        ).length;
        const scheduledToday = habits.filter((h) => isScheduledOn(h, new Date())).length;

        const overdue = habits.filter(
          (h) =>
            h.schedule.type === "deadline" &&
            h.schedule.dueDate < today &&
            !h.completions.includes(h.schedule.dueDate),
        ).length;

        const parentGiven = habits.filter(
          (h) => h.createdBy && h.createdBy !== viewingChild.id,
        ).length;

        const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
        const week = weekDates.map((d, i) => {
          const key = todayKey(d);
          let total = 0;
          let done = 0;
          habits.forEach((h) => {
            if (!isScheduledOn(h, d)) return;
            total += 1;
            if (h.completions.includes(key)) done += 1;
          });
          return { label: dayLabels[i], done, total, isToday: key === today };
        });

        return (
          <section className="py-0 px-6 mt-6">
            <div className="max-w-2xl mx-auto">
              <ChildStats
                childName={viewingChild.display_name ?? "votre enfant"}
                weekPct={weekPct}
                weekDone={weekDone}
                weekTotal={weekTotal}
                doneToday={doneToday}
                scheduledToday={scheduledToday}
                bestStreak={bestChildStreak}
                totalCompletions={totalCompletions}
                activeHabits={activeHabits}
                parentGiven={parentGiven}
                overdue={overdue}
                toApprove={childApprovals.length}
                week={week}
              />
            </div>
          </section>
        );
      })()}




      {!(profession === "parent" && studentMode && !selectedChild) && (
      <section className="py-0 px-6 mt-6">
        <div className="max-w-2xl mx-auto space-y-3">

          {parentGivenTodos.length > 0 && (
            <div className="rounded-2xl ring-1 ring-brand-primary/30 bg-brand-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  Tâches données par mes parents
                </h2>
                <span className="text-xs text-muted-foreground">
                  {parentGivenTodos.length} à faire
                </span>
              </div>
              <div className="space-y-2">
                {parentGivenTodos.map((h) => {
                  const pending = myPendingHabitIds.has(h.id);
                  const uploading = uploadingHabitId === h.id;
                  return (
                    <div
                      key={`parent-${h.id}`}
                      className="group flex items-center justify-between p-3 bg-card ring-1 ring-border rounded-xl"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleToday(h.id)}
                          disabled={pending || uploading}
                          aria-label={pending ? "En attente d'approbation" : "Envoyer une preuve"}
                          className={cn(
                            "size-7 rounded-md flex items-center justify-center transition-colors",
                            pending
                              ? "bg-amber-500/10 ring-1 ring-amber-500/40 text-amber-600 cursor-not-allowed"
                              : "ring-1 ring-border hover:ring-brand-primary cursor-pointer text-muted-foreground hover:text-brand-primary",
                          )}
                        >
                          {pending ? <Clock className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                        </button>
                        <div>
                          <p className="text-sm font-medium">{h.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {pending
                              ? "En attente d'approbation du parent"
                              : uploading
                                ? "Envoi de la preuve…"
                                : `${h.detail} · Envoyer une photo de mon travail`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {todaysHabits
            .filter((h) => !(user && h.createdBy && h.createdBy !== user.id))
            .map((h) => {
            const done = h.completions.includes(today);
            const streak = computeStreak(h.completions);
            return (
              <div
                key={h.id}
                className="group flex items-center justify-between p-4 bg-card ring-1 ring-border rounded-xl transition-transform hover:-translate-y-px"
              >
                <div className="flex items-center gap-4 flex-1">
                  <button
                    onClick={() => toggleToday(h.id)}
                    disabled={!!viewingChild}
                    aria-label={done ? "Marquer comme non fait" : "Marquer comme fait"}
                    className={cn(
                      "size-5 rounded-md flex items-center justify-center transition-colors",
                      viewingChild ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                      done
                        ? "bg-brand-primary ring-1 ring-brand-primary"
                        : "ring-1 ring-border hover:ring-brand-primary"
                    )}
                  >
                    {done && <div className="size-1.5 bg-white rounded-full" />}
                  </button>
                  <div>
                    <p
                      className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}
                    >
                      {h.name}
                    </p>
                    <p className={cn("text-xs", done ? "text-muted-foreground/50" : "text-muted-foreground")}>
                      {h.detail} · {describeSchedule(h.schedule)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {done ? (
                    <span
                      className="text-xs font-medium text-brand-primary"
                    >
                      Fait
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-brand-primary transition-colors">
                      <StreakFlame streak={streak} size={14} />
                      Série de {streak} j
                    </span>
                  )}
                  <button
                    onClick={() => removeHabit(h.id)}
                    aria-label="Supprimer l'habitude"
                    className="text-muted-foreground/40 hover:text-muted-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          {todaysHabits.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Rien de prévu aujourd'hui. Ajoutez une habitude ou une tâche.
            </p>
          )}

          {upcomingHabits.length > 0 && (
            <div className="pt-6">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Planifié
              </p>
              <div className="space-y-2">
                {upcomingHabits.map((h) => (
                  <div
                    key={h.id}
                    className="group flex items-center justify-between p-3 bg-muted/40 ring-1 ring-border rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground/60">
                        {h.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {describeSchedule(h.schedule)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeHabit(h.id)}
                      aria-label="Supprimer"
                      className="text-muted-foreground/40 hover:text-muted-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!studentMode || viewingChild) && (
            <div className="pt-8 flex justify-center">
              {!adding ? (
                <button
                  onClick={() => setAdding(true)}
                  className="bg-foreground text-background text-sm font-medium py-2 px-4 flex items-center gap-2 rounded-lg ring-1 ring-foreground hover:bg-foreground/80 transition-colors cursor-pointer"
                >
                  <span className="text-lg leading-none">+</span>
                  Nouvelle habitude ou tâche
                </button>
              ) : (
                <div className="w-full bg-card ring-1 ring-border rounded-xl p-4 space-y-4">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nom de l'habitude ou de la tâche"
                    className="w-full text-sm font-medium bg-transparent outline-none placeholder:text-muted-foreground/50"
                    onKeyDown={(e) => e.key === "Enter" && addHabit()}
                  />
                  <input
                    value={newDetail}
                    onChange={(e) => setNewDetail(e.target.value)}
                    placeholder="Détail (ex: 10 minutes • Matin)"
                    className="w-full text-xs bg-transparent outline-none placeholder:text-muted-foreground/50"
                  />

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Fréquence
                    </p>
                    <div className="flex gap-1 bg-muted/60 p-1 rounded-lg">
                      {(
                        [
                          ["daily", "Quotidien"],
                          ["weekly", "Hebdo"],
                          ["once", "Dates"],
                          ["deadline", "Échéance"],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setNewScheduleType(val)}
                          className={cn(
                            "flex-1 text-xs py-1.5 rounded-md transition-colors",
                            newScheduleType === val
                              ? "bg-card ring-1 ring-border text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {newScheduleType === "weekly" && (
                      <div className="flex gap-1 pt-1">
                        {WEEKDAY_PICKER.map((d) => {
                          const active = newWeekdays.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() =>
                                setNewWeekdays((prev) =>
                                  prev.includes(d.value)
                                    ? prev.filter((v) => v !== d.value)
                                    : [...prev, d.value],
                                )
                              }
                              className={cn(
                                "size-8 text-xs rounded-md transition-colors",
                                active
                                  ? "bg-brand-primary text-white"
                                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {newScheduleType === "once" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full text-left text-xs px-3 py-2 rounded-md bg-muted/60 hover:bg-muted text-foreground/60"
                          >
                            {newDates.length === 0
                              ? "Sélectionner une ou plusieurs dates"
                              : `${newDates.length} date${newDates.length > 1 ? "s" : ""} sélectionnée${newDates.length > 1 ? "s" : ""}`}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="multiple"
                            selected={newDates}
                            onSelect={(d) => setNewDates(d ?? [])}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    )}

                    {newScheduleType === "deadline" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full text-left text-xs px-3 py-2 rounded-md bg-muted/60 hover:bg-muted text-foreground/60"
                          >
                            {newDueDate
                              ? `À faire pour le ${newDueDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
                              : "Choisir une date d'échéance"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newDueDate}
                            onSelect={(d) => setNewDueDate(d ?? undefined)}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>


                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setAdding(false);
                        setNewName("");
                        setNewDetail("");
                        setNewScheduleType("daily");
                        setNewWeekdays([1, 2, 3, 4, 5]);
                        setNewDates([]);
                        setNewDueDate(undefined);
                      }}
                      className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:bg-muted"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={addHabit}
                      className="text-xs px-3 py-1.5 rounded-md bg-brand-primary text-white hover:opacity-90"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      )}


      {!studentMode && (
        <footer className="py-16 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-muted/40 ring-1 ring-border rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Meilleure série
                  </p>
                  <StreakFlame streak={bestStreak} size={22} />
                </div>
                <p className="text-2xl font-medium">
                  {bestStreak} <span className="text-sm font-normal text-muted-foreground">jours</span>
                </p>
                <div className="mt-4 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary transition-all"
                    style={{ width: `${Math.min(100, (bestStreak / 30) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="p-6 bg-muted/40 ring-1 ring-border rounded-2xl">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Taux de complétion
                </p>
                <p className="text-2xl font-medium">
                  {completionPct}% <span className="text-sm font-normal text-muted-foreground">semaine</span>
                </p>
                <div className="mt-4 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-muted transition-all"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-12">
              <img
                key={INSPIRATIONS[inspoIndex].image}
                src={INSPIRATIONS[inspoIndex].image}
                alt="Inspiration"
                width={1280}
                height={512}
                loading="lazy"
                className="w-full aspect-[3/1] object-cover outline-1 -outline-offset-1 outline-border rounded-[min(1vw,12px)] transition-opacity duration-700"
              />
              <p className="mt-4 text-sm text-muted-foreground max-w-[56ch] text-pretty">
                {INSPIRATIONS[inspoIndex].quote}
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
