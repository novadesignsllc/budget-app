import type { Envelope } from '@/domain/types';

/** A starting emoji from the envelope's name, until the user picks one. */
const RULES: [RegExp, string][] = [
  [/rent|mortgage|housing|home/i, '🏠'],
  [/electric|power/i, '💡'],
  [/water/i, '💧'],
  [/utilit/i, '🔌'],
  [/phone|mobile|cell/i, '📱'],
  [/internet|wifi/i, '📶'],
  [/subscri|stream|netflix|tv/i, '📺'],
  [/insur/i, '🛡️'],
  [/grocer/i, '🛒'],
  [/coffee/i, '☕'],
  [/eat|dining|restaurant|takeout|food/i, '🍔'],
  [/gas|fuel/i, '⛽'],
  [/car|auto|vehicle/i, '🚗'],
  [/gift/i, '🎁'],
  [/emergency/i, '🛟'],
  [/date/i, '💕'],
  [/\bfun\b|entertain|hobby/i, '🎉'],
  [/vacation|travel|trip/i, '✈️'],
  [/health|medical|doctor|pharm/i, '🩺'],
  [/gym|fitness/i, '🏋️'],
  [/kid|child|baby/i, '🧸'],
  [/pet|dog|cat/i, '🐶'],
  [/cloth/i, '👕'],
  [/household|amazon|shop/i, '🛍️'],
  [/save|saving/i, '🐷'],
  [/school|tuition|book/i, '📚'],
  [/hair|beauty/i, '💇'],
];

/** The envelope's emoji: the user's choice, else a guess from its name. */
export function envelopeEmoji(e: Pick<Envelope, 'name' | 'emoji' | 'debtAccountId'>): string {
  if (e.emoji) return e.emoji;
  if (e.debtAccountId) return '💳';
  return RULES.find(([re]) => re.test(e.name))?.[1] ?? '✉️';
}
