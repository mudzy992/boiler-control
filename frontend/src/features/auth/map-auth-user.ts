export type UserRole = 'USER' | 'ADMIN' | 'SUPPORT';

export interface AuthUser {
  id: number;
  email: string;
  username?: string | null;
  name: string;
  role: UserRole;
  plan?: string | null;
  prefersDarkMode?: boolean | null;
}

const ROLES: readonly UserRole[] = ['USER', 'ADMIN', 'SUPPORT'];

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && ROLES.includes(value as UserRole);

export const mapAuthUser = (raw: Record<string, unknown>): AuthUser => {
  const idRaw = raw.id;
  const id =
    typeof idRaw === 'number'
      ? idRaw
      : typeof idRaw === 'string'
        ? Number(idRaw)
        : NaN;
  return {
    id: Number.isFinite(id) ? id : 0,
    email: typeof raw.email === 'string' ? raw.email : '',
    username: typeof raw.username === 'string' ? raw.username : null,
    name: typeof raw.name === 'string' ? raw.name : '',
    role: isUserRole(raw.role) ? raw.role : 'USER',
    plan: typeof raw.plan === 'string' ? raw.plan : null,
    prefersDarkMode:
      typeof raw.prefersDarkMode === 'boolean' ? raw.prefersDarkMode : null,
  };
};
