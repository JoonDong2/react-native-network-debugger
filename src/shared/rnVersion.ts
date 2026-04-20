// 의존성 없이 major/minor만으로 RN 0.83 이상인지 판정한다.
// 서버/클라이언트 어느 쪽에서도 안전하게 import 가능.
export function isRNGte083(
  major: number | null | undefined,
  minor: number | null | undefined
): boolean {
  if (typeof major !== 'number' || typeof minor !== 'number') {
    return false;
  }
  if (major > 0) {
    return true;
  }
  return minor >= 83;
}

// "0.83.5" / "0.82.4-rc.0" 등 문자열 버전에서 major/minor 파싱
export function parseRNVersion(
  version: string | null | undefined
): { major: number; minor: number } | null {
  if (!version) return null;
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;
  return { major, minor };
}
