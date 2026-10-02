/** Accept the project URL, including a copied Supabase REST API URL. */
export function supabaseProjectUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      return null;
    if (!['', '/', '/rest/v1', '/rest/v1/'].includes(url.pathname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
