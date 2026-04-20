import fs from 'fs';
import path from 'path';
import os from 'os';

function copyDir(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchCommonJs(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');

  const varMatch = /resourceCategoriesReactNative:([A-Za-z_$][\w$]*)/.exec(content);
  if (!varMatch) return false;
  const varName = varMatch[1];

  const tokenRegex = new RegExp(
    `\\b${varName}=\\{XHR:new (\\w+)\\("Fetch and XHR",(\\w+)\\((\\w+)\\.fetchAndXHR\\),(\\w+)\\.i18n\\.lockedLazyString\\("Fetch/XHR"\\)\\)`
  );
  const tokenMatch = tokenRegex.exec(content);
  if (!tokenMatch) return false;
  const [, me, de, ue, r] = tokenMatch;

  const otherPattern = new RegExp(
    `,Other:new ${escapeRegex(me)}\\(${escapeRegex(ue)}\\.other,${escapeRegex(de)}\\(${escapeRegex(ue)}\\.other\\),${escapeRegex(de)}\\(${escapeRegex(ue)}\\.other\\)\\)\\}`
  );
  const blockStart = tokenMatch.index;
  const blockSlice = content.slice(blockStart);
  const relMatch = otherPattern.exec(blockSlice);
  if (!relMatch) return false;

  const innerBlock = blockSlice.slice(0, relMatch.index);
  if (innerBlock.includes('Socket:new ')) {
    return true; // 이미 패치됨
  }

  const socketEntry = `,Socket:new ${me}("Socket",${r}.i18n.lockedLazyString("WebSocket"),${de}(${ue}.socketShort))`;
  const absStart = blockStart + relMatch.index;
  const patched =
    content.slice(0, absStart) +
    socketEntry +
    content.slice(absStart, absStart + relMatch[0].length) +
    content.slice(absStart + relMatch[0].length);

  if (!patched.includes(socketEntry)) return false;

  fs.writeFileSync(filePath, patched);
  return true;
}

/** 소비 프로젝트의 @react-native/debugger-frontend dist 경로와 버전을 반환한다. */
export function resolveConsumerFrontendDist(): { dist: string; version: string } | null {
  try {
    const pkgPath = require.resolve('@react-native/debugger-frontend/package.json', {
      paths: [process.cwd()],
    });
    const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string };
    return { dist: path.resolve(path.dirname(pkgPath), 'dist'), version };
  } catch {
    return null;
  }
}

/**
 * consumerDist를 임시 디렉토리에 복사하고 WebSocket 필터 패치를 적용한다.
 * 성공 시 third-party/front_end 경로를 반환하고, 실패 시 null을 반환한다.
 */
export function preparePatchedFrontend(consumerDist: string): string | null {
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-network-debugger-'));
    copyDir(consumerDist, tmpDir);

    const commonJs = path.join(tmpDir, 'third-party/front_end/core/common/common.js');
    if (!fs.existsSync(commonJs)) return null;

    const patched = patchCommonJs(commonJs);
    if (!patched) return null;

    return path.join(tmpDir, 'third-party/front_end');
  } catch {
    return null;
  }
}
