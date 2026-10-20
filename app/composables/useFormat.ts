import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatRelative,
  formatTime,
} from '../utils/format';

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
    /** "21:42:10": the time of day with the seconds. */
    time: (iso: string) => formatTime(iso, locale.value, preferences.timezone),
    /** "12 minutes ago". Pass `now` from a clock that ticks so the text stays current. */
    relative: (iso: string, now: number = Date.now()) =>
      formatRelative(iso, locale.value, now, preferences.timezone),
  };
}
