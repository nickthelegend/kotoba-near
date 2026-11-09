// Generated art lives in public/art: stickers are kotoba-st-<subject>.webp (transparent, torn paper edges),
// event heroes kotoba-ev-<subject>.webp. Anything missing falls back to a drawn sticker or a duotone of the
// press-room photo, never a broken image.
const files = __ART__;
export const STICKERS = ['mic', 'building', 'gavel', 'newspaper', 'coin', 'podium'] as const;
export type StickerName = (typeof STICKERS)[number];
const pick = (prefix: string, name: string) => {
  const hits = files.filter((x) => x.startsWith(prefix) && x.includes(name));
  return hits.find((x) => x.endsWith('.webp')) ?? hits[0];
};
export function stickerSrc(name: StickerName): string | null {
  const f = pick('kotoba-st-', name);
  return f ? `/art/${f}` : null;
}
// Fed events: the press room first, then the columned building. The office tower is kept for earnings calls.
const EVENT_ORDER = ['fed', 'whitehouse', 'earnings'];
export function eventSrc(index: number): { src: string; generated: boolean } {
  const available = EVENT_ORDER.map((k) => pick('kotoba-ev-', k)).filter(Boolean) as string[];
  if (available.length) return { src: `/art/${available[index % available.length]}`, generated: true };
  return { src: '/art/kotoba-og.webp', generated: false };
}
