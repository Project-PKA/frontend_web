import type { ForbiddenAction } from '../utils/forbidden';

/**
 * Applies the action chosen for a 403 from the API: show the no-permission state, or send
 * the person back to pick a store. `none` leaves it to the screen that made the request.
 */
export function handleForbidden(action: ForbiddenAction, clearStore: () => void) {
  if (action === 'none') return;
  if (action === 'reselect-store') {
    clearStore();
    void navigateTo('/stores');
    return;
  }
  showError(createError({ statusCode: 403, fatal: true }));
}
