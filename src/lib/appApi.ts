export function getEdgeFunctionUrl(name: string): string {
  const supabaseUrl = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '')
    .trim()
    .replace(/\/+$/, '');
  return `${supabaseUrl}/functions/v1/${name}`;
}
