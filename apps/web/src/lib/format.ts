/** Format a decimal string without losing precision through Number conversion. */
export function money(value: string, currency = 'IQD') {
  const [whole = '0', decimal = ''] = value.split('.');
  const fraction = decimal.replace(/0+$/, '').padEnd(2, '0');
  return `${BigInt(whole).toLocaleString('en-US')}.${fraction} ${currency}`;
}
export function calendarDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
export function timestamp(value: string, timeZone = 'Asia/Baghdad') {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
}
