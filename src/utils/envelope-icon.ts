import type { Icon } from '@/components/icon';

type IconName = { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md'] };

/** Picks an icon from the envelope's name. Anything unmatched gets a plain tray. */
const RULES: [RegExp, IconName][] = [
  [/rent|mortgage|housing|home/i, { sf: 'house.fill', md: 'home' }],
  [/electric|utilit|power|water/i, { sf: 'bolt.fill', md: 'bolt' }],
  [/phone|mobile|cell/i, { sf: 'iphone', md: 'smartphone' }],
  [/internet|wifi/i, { sf: 'wifi', md: 'wifi' }],
  [/subscri|stream|netflix|tv/i, { sf: 'play.rectangle.fill', md: 'smart_display' }],
  [/insur/i, { sf: 'umbrella.fill', md: 'umbrella' }],
  [/grocer|food/i, { sf: 'cart.fill', md: 'shopping_cart' }],
  [/eat|dining|restaurant|takeout|coffee/i, { sf: 'fork.knife', md: 'restaurant' }],
  [/gas|fuel/i, { sf: 'fuelpump.fill', md: 'local_gas_station' }],
  [/car|auto|vehicle/i, { sf: 'car.fill', md: 'directions_car' }],
  [/gift/i, { sf: 'gift.fill', md: 'redeem' }],
  [/emergency/i, { sf: 'shield.fill', md: 'shield' }],
  [/\bfun\b|entertain|hobby/i, { sf: 'sparkles', md: 'celebration' }],
  [/save|saving|vacation|travel/i, { sf: 'airplane', md: 'flight' }],
  [/health|medical|doctor|pharm/i, { sf: 'cross.case.fill', md: 'medical_services' }],
  [/kid|child|baby/i, { sf: 'figure.and.child.holdinghands', md: 'family_restroom' }],
  [/pet|dog|cat/i, { sf: 'pawprint.fill', md: 'pets' }],
  [/cloth/i, { sf: 'tshirt.fill', md: 'checkroom' }],
  [/shop|household|amazon/i, { sf: 'bag.fill', md: 'shopping_bag' }],
];

export function envelopeIcon(name: string, isDebt?: boolean): IconName {
  if (isDebt) return { sf: 'creditcard.fill', md: 'credit_card' };
  return RULES.find(([re]) => re.test(name))?.[1] ?? { sf: 'tray.fill', md: 'inbox' };
}
