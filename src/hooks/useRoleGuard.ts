import { useAuth } from '../contexts/AuthContextInstance';
import { UserRole } from '../types';

/**
 * Route-level and action-level role guard.
 *
 * Usage:
 *   const { canView, canManage } = useRoleGuard();
 *   if (!canManage) return <Unauthorized />;
 *
 * Or restrict by specific roles:
 *   const allowed = useRoleGuard(['ncoic', 'leadership']);
 */
export function useRoleGuard(allowedRoles?: UserRole[]) {
  const { profile, isDemoMode } = useAuth();

  if (!profile) {
    return {
      /** Minimum: technician */
      isTechnician: false,
      /** NCOIC or higher */
      isNcoicOrAbove: false,
      /** Leadership only */
      isLeadership: false,
      /** User can view logs/training (all roles) */
      canView: false,
      /** User can manage: create/edit/delete (NCOIC+) */
      canManage: false,
      /** User can administer: setup, onboarding, diagnostics (Leadership) */
      canAdmin: false,
      /** True if the user's role is in the allowedRoles list (or all roles if empty) */
      isAllowed: false,
    };
  }

  const role = profile.role;
  const isTechnician = role === 'technician';
  const isNcoicOrAbove = role === 'ncoic' || role === 'leadership';
  const isLeadership = role === 'leadership';

  // All roles can view; demo mode grants elevated permissions for testing.
  const canView = true;
  const canManage = isDemoMode || isNcoicOrAbove;
  const canAdmin = isDemoMode || isLeadership;

  const isAllowed =
    !allowedRoles || allowedRoles.length === 0
      ? true
      : allowedRoles.includes(role) || (isDemoMode && allowedRoles.includes('leadership'));

  return {
    isTechnician,
    isNcoicOrAbove,
    isLeadership,
    canView,
    canManage,
    canAdmin,
    isAllowed,
  };
}
