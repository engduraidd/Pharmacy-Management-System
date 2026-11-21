export function settings() {
  const expiryAlertDays = Number(process.env.EXPIRY_ALERT_DAYS ?? '30');
  if (!Number.isInteger(expiryAlertDays) || expiryAlertDays < 1 || expiryAlertDays > 365) {
    throw new Error('EXPIRY_ALERT_DAYS must be between 1 and 365.');
  }
  const timeZone = process.env.APP_TIME_ZONE ?? 'Asia/Baghdad';
  new Intl.DateTimeFormat('en', { timeZone }).format();
  const currency = process.env.DISPLAY_CURRENCY ?? 'IQD';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('DISPLAY_CURRENCY must be a three-letter currency code.');
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';
  const parsed = new URL(webOrigin);
  if (parsed.origin !== webOrigin) throw new Error('WEB_ORIGIN must contain only an origin.');
  return { expiryAlertDays, timeZone, currency, webOrigin };
}
