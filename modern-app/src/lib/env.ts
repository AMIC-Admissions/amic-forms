function readEnv(name: string): string {
  const value = (import.meta.env[name as keyof ImportMetaEnv] as string | undefined)?.trim();
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  adminEmail: ((import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim() || 'admin@amic.school'),
};
