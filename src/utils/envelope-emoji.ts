import type { Envelope } from '@/domain/types';

/** A starting emoji from the envelope's name, until the user picks one. */
const RULES: [RegExp, string][] = [
  [/rent|mortgage|housing|home/i, '🏠'],
  [/electric|power|energy|duke|edison|pg&e/i, '⚡'],
  [/water/i, '💧'],
  [/utilit/i, '🔌'],
  [/phone|mobile|cell|verizon|t-mobile|at&t|cricket|visible/i, '📱'],
  [/internet|wifi|spectrum|xfinity|comcast|fios|starlink/i, '📶'],
  [/spotify|music|apple music|pandora|tidal/i, '🎧'],
  [/icloud|google one|dropbox|onedrive|storage/i, '☁️'],
  [/subscri|stream|netflix|hulu|disney|hbo|\bmax\b|peacock|paramount|youtube|tv/i, '📺'],
  [/insur|progressive|geico|state farm|allstate|liberty mutual/i, '🛡️'],
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
