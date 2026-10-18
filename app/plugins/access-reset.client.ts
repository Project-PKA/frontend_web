/** Forgets the profile and the current store as soon as the session ends. */
export default defineNuxtPlugin(() => {
  const session = useSessionStore();
  const access = useAccessStore();

  watch(
    () => session.status,
    (status) => {
      if (status === 'anonymous') access.reset();
    },
  );
});
