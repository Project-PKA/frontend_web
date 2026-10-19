import { formatDate, formatDateTime, formatMoney } from '../utils/format';

/**
 * Formatting in the active language, the profile's time zone and currency.
 * Money arrives as a decimal string and is never turned into a number.
 */
export function useFormat() {
  const { locale } = useI18n();
  const preferences = usePreferencesStore();

  return {
    money: (amount: string) => formatMoney(amount, locale.value, preferences.currency),
    dateTime: (iso: string) => formatDateTime(iso, locale.value, preferences.timezone),
    date: (iso: string) => formatDate(iso, locale.value, preferences.timezone),
  };
}
