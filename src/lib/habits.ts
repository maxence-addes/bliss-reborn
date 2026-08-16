export type Schedule =
  | { type: "daily" }
  | { type: "weekly"; weekdays: number[] }
  | { type: "once"; dates: string[] }
  | { type: "deadline"; dueDate: string };

export type Habit = {
  id: string;
  name: string;
  detail: string;
  completions: string[];
  schedule: Schedule;
  createdBy?: string | null;
};

export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getWeekDates = (ref = new Date()) => {
  const day = ref.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

export const computeStreak = (completions: string[]): number => {
  const set = new Set(completions);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

/**
 * Série globale : un jour ne compte que si TOUTES les habitudes quotidiennes
 * ont été cochées/validées ce jour-là. Les habitudes non quotidiennes
 * (hebdo, ponctuelles, échéances) sont ignorées.
 */
export const computeGlobalStreak = (habits: Habit[]): number => {
  const daily = habits.filter((h) => (h.schedule ?? { type: "daily" }).type === "daily");
  if (daily.length === 0) return 0;

  const allDone = (key: string) => daily.every((h) => h.completions.includes(key));

  let streak = 0;
  const cursor = new Date();
  if (!allDone(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (allDone(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const isScheduledOn = (habit: Habit, date: Date): boolean => {
  const s = habit.schedule ?? { type: "daily" };
  if (s.type === "daily") return true;
  if (s.type === "weekly") return s.weekdays.includes(date.getDay());
  if (s.type === "once") return s.dates.includes(todayKey(date));
  if (s.type === "deadline") return todayKey(date) <= s.dueDate;
  return true;
};

export const describeSchedule = (s: Schedule): string => {
  if (!s || s.type === "daily") return "Tous les jours";
  if (s.type === "weekly") {
    const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    if (s.weekdays.length === 0) return "Aucun jour";
    return s.weekdays
      .slice()
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((d) => labels[d])
      .join(" · ");
  }
  if (s.type === "once") {
    if (s.dates.length === 0) return "Aucune date";
    if (s.dates.length === 1) {
      const [y, m, d] = s.dates[0].split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
    }
    return `${s.dates.length} dates planifiées`;
  }
  if (s.type === "deadline") {
    const [y, m, d] = s.dueDate.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
    });
    return `À faire pour le ${label}`;
  }
  return "";
};
