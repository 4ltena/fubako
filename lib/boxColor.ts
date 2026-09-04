/** 箱の印の色。招待コードから決定的に導く。選ばせない（原則 A）。 */
export function boxColor(inviteCode: string): string {
  let h = 2166136261;
  for (let i = 0; i < inviteCode.length; i++) {
    h = Math.imul(h ^ inviteCode.charCodeAt(i), 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  const hue = (h >>> 0) % 360;
  return `hsl(${hue} 70% 55%)`;
}
