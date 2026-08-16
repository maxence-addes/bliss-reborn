import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  MessageCircle,
  Mail,
  Sparkles,
  
  ListChecks,
  Users,
  Bell,
  Camera,
  Trophy,
  Clock,
  Target,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STARTER_STEPS = [
  {
    icon: ListChecks,
    title: "Créez votre première habitude",
    body: "Appuyez sur le bouton « + » sur l'accueil. Donnez un nom, choisissez une fréquence (quotidienne, hebdomadaire, à une date précise ou une échéance) puis validez.",
  },
  {
    icon: Bell,
    title: "Activez les rappels",
    body: "Les habitudes planifiées apparaissent chaque jour sur l'accueil. Cochez-les au fur et à mesure pour garder votre série active.",
  },
  {
    icon: Users,
    title: "Liez un compte parent / enfant",
    body: "Ouvrez « Informations personnelles », copiez votre code d'invitation et partagez-le. L'autre compte le saisit dans la même section pour se lier.",
  },
  {
    icon: Camera,
    title: "Validez les preuves (parent)",
    body: "En mode parent, les preuves photo envoyées par l'enfant s'affichent dans « À valider ». Approuvez ou refusez chaque preuve d'un clic.",
  },
  {
    icon: Trophy,
    title: "Suivez les progrès",
    body: "Ouvrez la carte de statistiques de l'enfant pour voir l'anneau de progression, le graphique sur 7 jours et les indicateurs détaillés.",
  },
];

const CONSTANCY_TIPS = [
  {
    icon: Clock,
    title: "Commencez petit",
    body: "Visez 2 minutes par habitude au début. La régularité compte plus que la durée : mieux vaut 5 minutes chaque jour qu'une heure une fois par semaine.",
  },
  {
    icon: Target,
    title: "Une habitude à la fois",
    body: "Ne lancez pas trois nouvelles habitudes d'un coup. Maîtrisez-en une pendant deux semaines avant d'en ajouter une seconde.",
  },
  {
    icon: Bell,
    title: "Déclencheurs visuels",
    body: "Associez chaque habitude à un moment de la journée (après le petit-déjeuner, avant le coucher). L'application vous rappelle les tâches du jour.",
  },
  {
    icon: Trophy,
    title: "Célébrez les séries",
    body: "Chaque jour validé alimente votre série. Cassez la chaîne est normal ; l'objectif est de la reconstruire le plus vite possible.",
  },
  {
    icon: Camera,
    title: "Soyez indulgent",
    body: "Un jour manqué n'efface pas les progrès. Revenez le lendemain sans culpabilité : la constance se mesure sur des semaines, pas sur un jour.",
  },
];

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Aide — Daily Rhythms" },
      { name: "description", content: "Centre d'aide et FAQ Daily Rhythms." },
    ],
  }),
  component: HelpPage,
});

const FAQ = [
  {
    q: "Comment créer une habitude ?",
    a: "Depuis l'accueil, cliquez sur le bouton « + » pour ajouter une nouvelle habitude. Vous pouvez choisir une fréquence quotidienne, hebdomadaire, à des dates précises ou une échéance.",
  },
  {
    q: "Comment fonctionne le suivi de série ?",
    a: "Votre série augmente chaque jour où vous validez toutes vos habitudes prévues. Si vous manquez un jour planifié, la série recommence à zéro.",
  },
  {
    q: "Puis-je modifier la planification d'une habitude ?",
    a: "Pour le moment, vous pouvez supprimer une habitude et en créer une nouvelle avec la planification souhaitée.",
  },
  {
    q: "Comment lier un compte parent et un compte enfant ?",
    a: "Depuis le menu de votre compte, ouvrez « Lier un compte » et utilisez le code d'invitation partagé entre les deux comptes.",
  },
  {
    q: "Mes données sont-elles privées ?",
    a: "Oui. Vos habitudes et votre profil ne sont visibles que par vous. Les comptes liés (parent/enfant) ne partagent que les informations strictement nécessaires.",
  },
];

function HelpPage() {
  const navigate = useNavigate();
  const [openGuide, setOpenGuide] = useState(false);
  const [openTips, setOpenTips] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate({ to: "/" })}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <h1 className="text-3xl font-bold mb-1">Centre d'aide</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Trouvez des réponses ou contactez-nous.
        </p>

        <section className="grid sm:grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => setOpenGuide(true)}
            className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/60 hover:bg-accent/40 transition-colors"
          >
            <BookOpen className="w-5 h-5 mb-3 text-primary" />
            <p className="font-medium">Guide de démarrage</p>
            <p className="text-xs text-muted-foreground mt-1">
              Apprenez à créer vos premières habitudes en quelques minutes.
            </p>
          </button>
          <button
            onClick={() => setOpenTips(true)}
            className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/60 hover:bg-accent/40 transition-colors"
          >
            <Sparkles className="w-5 h-5 mb-3 text-primary" />
            <p className="font-medium">Astuces de constance</p>
            <p className="text-xs text-muted-foreground mt-1">
              Concentrez-vous sur la fréquence avant l'intensité.
            </p>
          </button>
        </section>

        <Dialog open={openGuide} onOpenChange={setOpenGuide}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Guide de démarrage
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {STARTER_STEPS.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <step.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {i + 1}. {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={openTips} onOpenChange={setOpenTips}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Astuces de constance
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {CONSTANCY_TIPS.map((tip, i) => (
                <div key={i} className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <tip.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tip.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {tip.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>


        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Questions fréquentes
        </h2>
        <div className="rounded-2xl border border-border bg-card px-5">
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-8 mb-3">
          Nous contacter
        </h2>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <a
            href="mailto:maxence.addes@laposte.net"
            className="flex items-center gap-3 text-sm hover:text-primary transition-colors break-all"
          >
            <Mail className="w-4 h-4 shrink-0" /> maxence.addes@laposte.net
          </a>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <MessageCircle className="w-4 h-4 shrink-0" /> Réponse sous 1 semaine
          </div>
        </div>
      </div>
    </div>
  );
}
