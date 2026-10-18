import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createApiClient } from '../api/client';
import { createAuthApi, type AuthApi, type SessionPayload, type SessionUser } from '../api/auth';
import { ApiError } from '../api/errors';

export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Builds the session store around an auth API. The access token lives only in
 * memory: it is never written to storage. The refresh token is an httpOnly
 * cookie the browser sends on its own.
 */
export function defineSessionStore(getAuthApi: () => AuthApi, id = 'session') {
  return defineStore(id, () => {
    const accessToken = ref<string | null>(null);
    const user = ref<SessionUser | null>(null);
    const status = ref<SessionStatus>('unknown');
    const isAuthenticated = computed(() => status.value === 'authenticated');

    let inflightRefresh: Promise<boolean> | null = null;

    function apply(payload: SessionPayload) {
      accessToken.value = payload.access_token;
      user.value = payload.user;
      status.value = 'authenticated';
    }

    function clear() {
      accessToken.value = null;
      user.value = null;
      status.value = 'anonymous';
    }

    async function requestOtp(email: string) {
      await getAuthApi().requestOtp(email);
    }

    async function login(email: string, code: string) {
      apply(await getAuthApi().verifyOtp(email, code));
    }

    /**
     * Renews the session with the refresh cookie. Concurrent callers share one
     * request. A rejected refresh ends the session; a network failure does not,
     * so a brief outage does not log the person out.
     */
    function refresh(): Promise<boolean> {
      inflightRefresh ??= (async () => {
        try {
          apply(await getAuthApi().refresh());
          return true;
        } catch (error) {
          if (error instanceof ApiError && error.kind === 'http') clear();
          return false;
        } finally {
          inflightRefresh = null;
        }
      })();
      return inflightRefresh;
    }

    /** Called once when a page needs to know who is logged in. */
    async function restore() {
      if (status.value !== 'unknown') return;
      await refresh();
      if (status.value === 'unknown') status.value = 'anonymous';
    }

    async function logout() {
      try {
        await getAuthApi().logout();
      } catch {
        // The local session ends even if the server could not be reached.
      }
      clear();
    }

    return {
      accessToken,
      user,
      status,
      isAuthenticated,
      requestOtp,
      login,
      refresh,
      restore,
      logout,
    };
  });
}

/** The store the app uses, wired to the configured API. */
export const useSessionStore = defineSessionStore(() => {
  const { public: config } = useRuntimeConfig();
  return createAuthApi(
    createApiClient({
      baseUrl: config.apiBaseUrl,
      getAccessToken: () => null,
      getStoreId: () => null,
      refreshSession: () => Promise.resolve(false),
    }),
  );
});
