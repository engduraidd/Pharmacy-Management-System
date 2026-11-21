/** Validate configuration without echoing potentially sensitive input in errors. */
export function parsePort(value: string | undefined): number {
  if (value === undefined) return 3001;
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer between 1 and 65535.');
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  return port;
}
