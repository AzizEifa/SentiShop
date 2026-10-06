// src/app/core/language.ts — langue d'un avis, estimée dans le navigateur
//
// Le backend ne stocke pas la langue : on l'estime par l'alphabet (arabe) puis par les mots
// les plus courants (français / anglais). C'est une estimation, affichée comme telle,
// et non une sortie du modèle d'IA.

export type Lang = 'FR' | 'EN' | 'AR' | '?';

export const LANG_LABEL: Record<Lang, string> = { FR: 'Français', EN: 'Anglais', AR: 'Arabe', '?': 'Indéterminée' };

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/g;
const LETTERS = /[A-Za-zÀ-ÿ؀-ۿ]/g;

const FR = new Set(['le', 'la', 'les', 'des', 'est', 'et', 'je', 'pas', 'tres', 'très', 'un', 'une', 'du', 'de', 'pour', 'mais', 'avec', 'que', 'qui', 'produit', 'livraison', 'bien', 'trop', 'ce', 'cet', 'cette', 'mon', 'ma', 'au', 'en', 'sur', 'il', 'elle', 'vraiment', 'recommande', 'qualité', 'été', 'à', 'ça', 'plus', 'rien', 'sont', 'nous', 'vous', 'sans', 'correct', 'déçu', 'livré', 'colis', 'reçu', 'cassé', 'parfait', 'nul']);
const EN = new Set(['the', 'is', 'and', 'it', 'was', 'not', 'very', 'a', 'an', 'of', 'to', 'for', 'but', 'with', 'this', 'that', 'my', 'i', 'product', 'delivery', 'good', 'bad', 'great', 'quality', 'would', 'after', 'one', 'week', 'broke', 'love', 'are', 'have', 'has', 'too', 'really', 'recommend', 'no', 'at', 'on', 'in', "it's", 'ok', 'nothing', 'special', 'buy', 'again', 'price', 'terrible', 'works', 'fast', 'slow', 'arrived', 'never', 'cheap', 'worth', 'well']);

/** Estime la langue d'un texte (FR, EN, AR) ; « ? » si le texte est trop court ou ambigu. */
export function detectLanguage(text: string | null | undefined): Lang {
  const t = (text ?? '').trim();
  const letters = t.match(LETTERS)?.length ?? 0;
  if (!letters) return '?';
  if ((t.match(ARABIC)?.length ?? 0) / letters > 0.3) return 'AR';
  const words = t.toLowerCase().split(/[^a-zà-ÿ']+/).filter(Boolean);
  let fr = 0;
  let en = 0;
  for (const w of words) {
    if (FR.has(w)) fr++;
    if (EN.has(w)) en++;
  }
  if (/[àâçéèêëîïôûùüÿœ]/i.test(t)) fr++;
  if (fr === en) return '?';
  return fr > en ? 'FR' : 'EN';
}

/** Mots vides ignorés lors du repérage des mots fréquents. */
const STOP = new Set([...FR, ...EN,
  'ne', 'se', 'sa', 'son', 'ses', 'on', 'tout', 'toujours', 'jamais', 'aussi', 'encore', 'fait', 'avoir', 'être', 'suis', 'était', 'avait',
  'just', 'did', 'does', 'its', 'all', 'from', 'they', 'you', 'were', 'been', 'what', 'when', 'than', 'then', 'only', 'even', 'there',
  'في', 'من', 'على', 'عن', 'إلى', 'الى', 'هذا', 'هذه', 'ما', 'لا', 'لم', 'لن', 'مع', 'كان', 'أو', 'ثم', 'جدا', 'كل', 'قد', 'هو', 'هي', 'أن', 'التي', 'الذي']);

/**
 * Mots les plus fréquents d'un ensemble d'avis (comptés une fois par avis, mots vides exclus).
 * Sert à repérer des sujets récurrents ; c'est un simple comptage, pas une analyse de l'IA.
 */
export function frequentWords(texts: string[], limit = 8): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const words = new Set(text.toLowerCase().split(/[^a-zà-ÿœ؀-ۿ]+/).filter((w) => w.length > 3 && !STOP.has(w)));
    words.forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1));
  }
  return [...counts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}
