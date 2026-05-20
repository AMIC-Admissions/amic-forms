import { supabase } from './supabase';

export type UserRole = 'super_admin' | 'admin' | 'staff';

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return (data?.role as UserRole) ?? null;
}

export async function ensureUserRole(userId: string, defaultRole: UserRole = 'staff'): Promise<UserRole> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (data?.role) return data.role as UserRole;

  await supabase.from('user_roles').insert({ user_id: userId, role: defaultRole });
  return defaultRole;
}
