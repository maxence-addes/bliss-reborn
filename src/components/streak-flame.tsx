import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type StreakFlameProps = {
  streak: number;
  /** Taille de base du cercle en px (hauteur/largeur) */
  size?: number;
  className?: string;
};

/**
 * Affiche une flamme dont la taille, la couleur et l'halo
 * s'intensifient en fonction de la durée de la série (streak).
 *
 * Échelons :
 *  - 0        : flamme éteinte (gris, taille min)
 *  - 1-3 j    : petite flamme orange
 *  - 4-6 j    : flamme orange vif + halo léger
 *  - 7-13 j   : flamme rouge-orange + halo moyen
 *  - 14-29 j  : grosse flamme rouge + halo marqué
 *  - 30 j+    : flamme maximale, rouge profond, halo large
 */
export function StreakFlame({ streak, size = 18, className }: StreakFlameProps) {
  const s = Math.max(0, streak);

  // Facteur d'échelle : passe de 0.7 (streak 0) à 1.6 (streak 30+)
  const scale = Math.min(1.6, 0.7 + (s / 30) * 0.9);

  // Niveau d'intensité 0..4
  const tier =
    s === 0 ? 0 : s <= 3 ? 1 : s <= 6 ? 2 : s <= 13 ? 3 : s <= 29 ? 4 : 5;

  const colorByTier: Record<number, string> = {
    0: "text-muted-foreground/40",
    1: "text-amber-400",
    2: "text-orange-500",
    3: "text-orange-600",
    4: "text-red-500",
    5: "text-red-600",
  };

  const haloOpacity = [0, 0.12, 0.22, 0.35, 0.5, 0.65][tier];
  const haloColor = [
    "rgba(120,120,120,0.2)",
    "rgba(251,191,36,0.45)", // amber
    "rgba(249,115,22,0.5)", // orange
    "rgba(234,88,12,0.55)", // orange-600
    "rgba(239,68,68,0.6)", // red-500
    "rgba(220,38,38,0.7)", // red-600
  ][tier];

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Halo / aura qui grandit avec la série */}
      <span
        className="absolute inset-0 rounded-full blur-md transition-all duration-500"
        style={{
          background: haloColor,
          opacity: haloOpacity,
          transform: `scale(${scale * 1.15})`,
        }}
        aria-hidden
      />
      {/* Flamme */}
      <Flame
        className={cn("relative transition-all duration-500", colorByTier[tier])}
        style={{
          width: size,
          height: size,
          transform: `scale(${scale})`,
          filter: tier >= 3 ? "drop-shadow(0 0 2px currentColor)" : "none",
        }}
        fill={tier >= 2 ? "currentColor" : "none"}
        strokeWidth={tier === 0 ? 2 : 1.5}
      />
      {tier >= 4 && (
        <Flame
          className="absolute inset-0 m-auto animate-pulse text-yellow-200/70"
          style={{ width: size * 0.6, height: size * 0.6 }}
          fill="currentColor"
          strokeWidth={0}
          aria-hidden
        />
      )}
    </span>
  );
}
