/**
 * Keeps the interface language in step with the person on the app pages (the
 * ones without a language in the URL): the first language comes from the device,
 * and the language saved in the profile takes over once the person is logged in.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter();
  const session = useSessionStore();
  const preferences = usePreferencesStore();

  const isAppPage = (route: { meta: Record<string, unknown> }) => route.meta.i18n === false;

  router.afterEach((to) => {
    if (isAppPage(to)) void preferences.init();
  });

  watch(
    () => session.isAuthenticated,
    async (authenticated) => {
      if (!authenticated) {
        preferences.clearProfile();
        return;
      }
      try {
        await preferences.load();
      } catch {
        // Offline or a failed request: the language from this device stays.
      }
    },
  );
});
