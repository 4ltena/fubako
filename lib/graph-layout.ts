import type { RelatedPost } from "./similarity-graph";

export const GRAPH_LIMIT = 30;
export type GraphEdge = { source: string; target: string; strength: number };
export type GraphPoint = { id: string; x: number; y: number };

export function expandGraph(existing: readonly string[], selected: string, nodes: readonly { id: string; related?: RelatedPost[] }[], limit = GRAPH_LIMIT): string[] {
  const allowed = new Set(nodes.map((node) => node.id));
  if (!allowed.has(selected)) return existing.filter((id) => allowed.has(id)).slice(0, limit);
  return [...new Set([selected, ...(nodes.find((node) => node.id === selected)?.related ?? []).map((link) => link.postId), ...existing.filter((id) => allowed.has(id))])]
    .filter((id) => allowed.has(id)).slice(0, limit);
}

/** SABERAの順位に応じた放射配置をWeb向けに適用。近い語ほど内側、選択点は原点。 */
export function layoutGraph(ids: readonly string[], center: string, edges: readonly GraphEdge[]): GraphPoint[] {
  const strength = (id: string) => edges.reduce((best, edge) => ((edge.source === center && edge.target === id) || (edge.target === center && edge.source === id)) ? Math.max(best, edge.strength) : best, 0);
  const peers = ids.filter((id) => id !== center).sort((a, b) => strength(b) - strength(a) || a.localeCompare(b));
  return [{ id: center, x: 0, y: 0 }, ...peers.map((id, index) => {
    const angle = 2 * Math.PI * index / Math.max(peers.length, 1) - Math.PI / 2;
    // 点ではなく便箋の幅と高さを確保する。密な場合は余白を移動してたどる。
    const radius = Math.max(300, peers.length * 360 / (2 * Math.PI)) + (1 - strength(id)) * 150;
    return { id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  })];
}
