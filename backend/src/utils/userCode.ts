import { supabase } from '../config/supabase';

const ROLE_PREFIX: Record<string, string> = {
  ADMIN: 'AD',
  SALES: 'SL',
  MANAGEMENT: 'MP',
};

/**
 * Auto-generates the next userCode for a given role.
 * Pattern: SL_001, SL_002, AD_001, MP_001 etc.
 */
export async function generateUserCode(roleName: string): Promise<string> {
  const prefix = ROLE_PREFIX[roleName.toUpperCase()] || 'US';

  const { data: users } = await supabase
    .from('User')
    .select('userCode')
    .like('userCode', `${prefix}_%`)
    .order('createdAt', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (users && users.length > 0 && users[0].userCode) {
    const parts = users[0].userCode.split('_');
    nextNumber = parseInt(parts[1] || '0', 10) + 1;
  }

  return `${prefix}_${String(nextNumber).padStart(3, '0')}`;
}
