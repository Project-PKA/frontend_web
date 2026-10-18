import { ApiError } from '../api/errors';
import { decideAccess } from '../utils/access';

declare module '#app' {
  interface PageMeta {
    /** What the page needs; a page without it is public. See `AccessRule`. */
    access?: import('../utils/access').AccessRule;
    /** Translation key of the page title: the layout shows it as the heading of the page. */
    titleKey?: string;
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  const rule = to.meta.access;
  if (!rule) return;

  const session = useSessionStore();
  const access = useAccessStore();

  await session.restore();
  if (!session.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }

  try {
    if (rule.level === 'admin') await access.loadMe();
    if (rule.level === 'store') await access.loadStore();
  } catch (error) {
    // Not a member of that store anymore: choose again.
    if (error instanceof ApiError && error.status === 403) {
      access.clearStore();
      return navigateTo('/stores');
    }
    throw error;
  }

  const decision = decideAccess(rule, {
    authenticated: true,
    isPlatformAdmin: access.isPlatformAdmin,
    storeId: access.storeId,
    role: access.role,
    permissions: access.permissions,
  });

  if (decision.kind === 'select-store') return navigateTo('/stores');
  if (decision.kind === 'forbidden') {
    return abortNavigation(
      createError({
        statusCode: 403,
        fatal: true,
        data: { reason: decision.reason, permission: decision.permission },
      }),
    );
  }
});
