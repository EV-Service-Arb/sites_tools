import type { KitOffer } from "../../core/kit";

export interface Words {
  title: string;
  intro: string;
  start: string;
  of: (i: number, n: number) => string;
  prev: string;
  next: string;
  edit: string;
  chars: (n: number) => string;
  save: (n: number) => string;
  savedNote: string;
  cta: string;
  ctaHint: string;
  own: string;
  oneTap: string;
  oneTapHint: string;
}

export const WORDS: Record<KitOffer["lang"], Words> = {
  fr: {
    title: "Merci de votre confiance",
    intro: "En manque de mots ? Partez de ce que d’autres ont dit de ce travail, et changez ce que vous voulez.",
    start: "Un point de départ",
    of: (i, n) => `${i} sur ${n}`,
    prev: "Précédent",
    next: "Suivant",
    edit: "touchez pour tout changer",
    chars: n => `${n} caractères`,
    save: n => (n === 1 ? "Enregistrer la photo" : `Enregistrer ${n} photos`),
    savedNote: "Enregistrées, elles viennent en premier dans votre galerie : Google les propose après les étoiles (Ajouter des photos → cochez).",
    cta: "Copier et ouvrir Google",
    ctaHint: "Google s’ouvre sur l’avis : touchez vos étoiles, puis collez.",
    own: "Écrire le mien →",
    oneTap: "Votre avis sur Google",
    oneTapHint: "copié en touchant : collez-le, changez-le, ou écrivez le vôtre",
  },
  en: {
    title: "Thanks for trusting us",
    intro: "Short of words? Start from what others said about this job, and change whatever you like.",
    start: "A starting point",
    of: (i, n) => `${i} of ${n}`,
    prev: "Previous",
    next: "Next",
    edit: "tap to change anything",
    chars: n => `${n} chars`,
    save: n => (n === 1 ? "Save the photo" : `Save ${n} photos`),
    savedNote: "Saved, they come first in your gallery: Google offers them after the stars (Add photos → tick).",
    cta: "Copy & open Google",
    ctaHint: "Google opens on the review: tap your stars, then paste.",
    own: "Write my own instead →",
    oneTap: "Tap to review on Google",
    oneTapHint: "copied with the tap — paste it, change it, or write your own",
  },
};
