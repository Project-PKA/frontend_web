/** Short messages after an action. Pass text that is already translated. */
export function useToast() {
  const store = useToastStore();

  return {
    success: (message: string) => store.show(message, 'success'),
    info: (message: string) => store.show(message, 'info'),
    warning: (message: string) => store.show(message, 'warning'),
    error: (message: string) => store.show(message, 'danger'),
  };
}
