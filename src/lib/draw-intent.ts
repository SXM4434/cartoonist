/**
 * Decides whether a drawing request asks for product screens (wireframes)
 * or for a structural diagram. Only the latest request counts: an earlier
 * "wireframe" in the conversation must not turn every later flow, timeline
 * or comparison into a screen mockup.
 */
const EXPLICIT_UI = /\b(high[-\s]?fi(?:delity)?|wireframes?|mock[-\s]?ups?|ui screens?|screens?|app (?:screen|page)s?|website (?:screen|page)s?|product screens?|landing page design)\b/i;
const SOFT_UI = /\b(interface|dashboard|editor|homepage|settings page|ui)\b/i;
const STRUCTURE = /\b(flow|flowchart|process|journey|steps?|timeline|roadmap|compare|comparison|versus|vs\.?|pros|cons|decision|tree|hierarchy|org chart|cycle|loop|outline|diagram|chart|graph|funnel|map)\b/i;

export function wantsUiWireframe(latest: string): boolean {
  const text = latest.trim();
  if (!text) return false;
  if (EXPLICIT_UI.test(text)) return true;
  return SOFT_UI.test(text) && !STRUCTURE.test(text);
}
