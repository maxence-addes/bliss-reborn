import { useState } from "react";
import { ChevronDown, TrendingUp, CalendarCheck, ClipboardList, AlertTriangle, ShieldCheck } from "lucide-react";
import { StreakFlame } from "@/components/streak-flame";
import { cn } from "@/lib/utils";

export type ChildStatsData = {
  childName: string;
  weekPct: number;
  weekDone: number;
  weekTotal: number;
  doneToday: number;
  scheduledToday: number;
  bestStreak: number;
  totalCompletions: number;
  activeHabits: number;
  parentGiven: number;
  overdue: number;
  toApprove: number;
  /** 7 entries (lundi → dimanche) */
  week: { label: string; done: number; total: number; isToday: boolean }[];
};

function ProgressRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-brand-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {value}%
      </span>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0",
          tone === "warn"
            ? "bg-amber-500/10 text-amber-600"
            : "bg-brand-primary/10 text-brand-primary",
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ChildStats(props: ChildStatsData) {
  const [open, setOpen] = useState(false);
  const {
    childName,
    weekPct,
    weekDone,
    weekTotal,
    doneToday,
    scheduledToday,
    bestStreak,
    totalCompletions,
    activeHabits,
    parentGiven,
    overdue,
    toApprove,
    week,
  } = props;

  return (
    <div className="bg-card ring-1 ring-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left p-4 flex items-center gap-4 hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <ProgressRing value={weekPct} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            Statistiques de {childName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {weekDone}/{weekTotal} tâches cette semaine · {doneToday}/{scheduledToday} aujourd'hui
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2 items-center">
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              <StreakFlame streak={bestStreak} size={12} /> Série {bestStreak} j
            </span>
            {overdue > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                {overdue} en retard
              </span>
            )}
            {toApprove > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary">
                {toApprove} à valider
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-border space-y-5">
            {/* Semaine */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                Régularité sur 7 jours
              </p>
              <div className="flex items-end justify-between gap-1.5 h-24">
                {week.map((d, i) => {
                  const pct = d.total === 0 ? 0 : (d.done / d.total) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex-1 flex items-end">
                        <div className="w-full h-full rounded-md bg-muted flex items-end overflow-hidden">
                          <div
                            className={cn(
                              "w-full rounded-md transition-all duration-500",
                              pct >= 100 ? "bg-brand-primary" : "bg-brand-primary/50",
                            )}
                            style={{ height: `${Math.max(pct, d.total ? 6 : 0)}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[10px]",
                          d.isToday
                            ? "text-brand-primary font-semibold"
                            : "text-muted-foreground",
                        )}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Détails */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Performance
              </p>
              <div className="divide-y divide-border">
                <StatRow
                  icon={TrendingUp}
                  label="Progression hebdomadaire"
                  hint={`${weekDone} sur ${weekTotal} tâches prévues`}
                  value={`${weekPct}%`}
                />
                <StatRow
                  icon={CalendarCheck}
                  label="Aujourd'hui"
                  hint="tâches réalisées"
                  value={`${doneToday}/${scheduledToday}`}
                />
                <div className="flex items-center gap-3 py-2.5">
                  <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-primary/10">
                    <StreakFlame streak={bestStreak} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">Meilleure série</p>
                    <p className="text-[11px] text-muted-foreground">jours consécutifs</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{bestStreak} j</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Charge & suivi
              </p>
              <div className="divide-y divide-border">
                <StatRow
                  icon={ClipboardList}
                  label="Tâches actives"
                  hint={`${parentGiven} données par vous · ${totalCompletions} complétées au total`}
                  value={String(activeHabits)}
                />
                <StatRow
                  icon={AlertTriangle}
                  label="Échéances en retard"
                  hint="dates dépassées"
                  value={String(overdue)}
                  tone={overdue > 0 ? "warn" : "default"}
                />
                <StatRow
                  icon={ShieldCheck}
                  label="Preuves à valider"
                  hint="en attente de votre validation"
                  value={String(toApprove)}
                  tone={toApprove > 0 ? "warn" : "default"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
