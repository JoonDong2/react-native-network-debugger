import { isRNGte083, parseRNVersion } from '../../shared/rnVersion';

export function isRNGte083Server(cliVersion: string | null | undefined): boolean {
  const parsed = parseRNVersion(cliVersion);
  if (!parsed) return false;
  return isRNGte083(parsed.major, parsed.minor);
}
