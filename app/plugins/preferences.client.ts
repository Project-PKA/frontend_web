/**
 * Keeps the theme, and the interface language on the app pages (the ones without a
 * language in the URL), in step with the person: the first values come from the device,
 * and the ones saved in the profile take over once the person is logged in.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter();
  const session = useSessionStore();
  const preferences = usePreferencesStore();

  preferences.initTheme();

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
        // Offline or a failed request: what is on this device stays.
      }
    },
  );
});
