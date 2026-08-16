// Échelle scolaire française, de la maternelle au supérieur.
export const SCHOOL_LADDER = [
  "Petite section",
  "Moyenne section",
  "Grande section",
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "Sixième",
  "Cinquième",
  "Quatrième",
  "Troisième",
  "Seconde",
  "Première",
  "Terminale",
  "Études supérieures",
] as const;

export type SchoolLevel = (typeof SCHOOL_LADDER)[number] | string;

/**
 * Année de rentrée en cours : une année scolaire commence en août.
 * Ex. mars 2026 -> 2025 (année scolaire 2025-2026).
 */
export function currentSchoolYear(date: Date = new Date()): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

/** Libellé de l'année scolaire, ex. "2025-2026". */
export function schoolYearLabel(year: number = currentSchoolYear()): string {
  return `${year}-${year + 1}`;
}

/** Avance un niveau de `years` rentrées ; s'arrête au dernier palier. */
export function advanceLevel(level: string, years: number): string {
  if (years <= 0) return level;
  const idx = SCHOOL_LADDER.indexOf(level as (typeof SCHOOL_LADDER)[number]);
  if (idx === -1) return level; // niveau libre / inconnu : inchangé
  return SCHOOL_LADDER[Math.min(idx + years, SCHOOL_LADDER.length - 1)]!;
}

/** Niveau actuel à partir du niveau saisi lors de l'année scolaire `baseYear`. */
export function levelForNow(
  level: string,
  baseYear: number | null | undefined,
  now: Date = new Date(),
): string {
  if (!baseYear) return level;
  return advanceLevel(level, currentSchoolYear(now) - baseYear);
}

/** Applique la progression à une liste de niveaux. */
export function levelsForNow(
  levels: string[],
  baseYear: number | null | undefined,
  now: Date = new Date(),
): string[] {
  return levels.map((l) => levelForNow(l, baseYear, now));
}
