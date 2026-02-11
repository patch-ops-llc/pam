/** Convert "- " list items to bullet points (•) in prose content */
export function formatProseWithBullets(text: string): string {
  if (!text) return "";
  return text.replace(/\n- /g, "\n• ").replace(/^- /g, "• ");
}
