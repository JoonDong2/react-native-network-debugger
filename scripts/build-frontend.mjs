#!/usr/bin/env node
// @react-native/debugger-frontend dist를 복사 후, RN 전용 네트워크 패널의
// resourceCategoriesReactNative 정의에 WebSocket(Socket) 필터 카테고리를 주입한다.
//
// 이 번들이 minified 되어 있으므로, 정의부의 다른 엔트리(XHR 엔트리)에서
// minifier가 부여한 식별자(`me`, `ue`, `de`, `r` 등)를 파싱해 Socket 엔트리에 재사용한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(ROOT, 'assets', 'debugger-frontend');

function resolveFrontendSrc() {
  const pkgPath = require.resolve('@react-native/debugger-frontend/package.json');
  return path.resolve(path.dirname(pkgPath), 'dist');
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchCommonJs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. resourceCategoriesReactNative가 가리키는 객체 변수명 추출
  const varMatch = /resourceCategoriesReactNative:([A-Za-z_$][\w$]*)/.exec(content);
  if (!varMatch) {
    throw new Error(`resourceCategoriesReactNative 참조를 ${filePath}에서 찾지 못했습니다.`);
  }
  const varName = varMatch[1];

  // 2. 해당 객체 정의부(XHR 엔트리)에서 minifier 토큰 추출
  const tokenRegex = new RegExp(
    `\\b${varName}=\\{XHR:new (\\w+)\\("Fetch and XHR",(\\w+)\\((\\w+)\\.fetchAndXHR\\),(\\w+)\\.i18n\\.lockedLazyString\\("Fetch/XHR"\\)\\)`
  );
  const tokenMatch = tokenRegex.exec(content);
  if (!tokenMatch) {
    throw new Error(
      `${varName}의 XHR 엔트리를 식별하지 못했습니다. 원본 번들 구조가 바뀌었을 가능성이 있습니다.`
    );
  }
  const [, me, de, ue, r] = tokenMatch;

  // 3. 같은 블록의 Other 엔트리(블록 종결 직전) 찾기 — 식별된 토큰을 그대로 사용해 정확성 확보
  const otherPattern = new RegExp(
    `,Other:new ${escapeRegex(me)}\\(${escapeRegex(ue)}\\.other,${escapeRegex(de)}\\(${escapeRegex(ue)}\\.other\\),${escapeRegex(de)}\\(${escapeRegex(ue)}\\.other\\)\\)\\}`
  );
  // 블록 시작 이후로 범위를 좁혀 검색
  const blockStart = tokenMatch.index;
  const blockSlice = content.slice(blockStart);
  const relMatch = otherPattern.exec(blockSlice);
  if (!relMatch) {
    throw new Error(`${varName} 블록 종료부(Other 엔트리)를 찾지 못했습니다.`);
  }

  // 4. idempotence — XHR~Other 사이에 Socket 엔트리가 이미 주입됐는지 확인
  const innerBlock = blockSlice.slice(0, relMatch.index);
  if (innerBlock.includes('Socket:new ')) {
    console.log('[build-frontend] Socket 필터가 이미 주입되어 있음 — 패치 skip');
    return false;
  }

  const socketEntry = `,Socket:new ${me}("Socket",${r}.i18n.lockedLazyString("WebSocket"),${de}(${ue}.socketShort))`;
  const absStart = blockStart + relMatch.index;
  const absEnd = absStart + relMatch[0].length;

  const patched = content.slice(0, absStart) + socketEntry + content.slice(absStart, absEnd) + content.slice(absEnd);

  // 간단 검증
  if (!patched.includes(socketEntry)) {
    throw new Error('패치 결과에 Socket 엔트리가 포함되지 않음 (치환 실패).');
  }

  fs.writeFileSync(filePath, patched);
  console.log(`[build-frontend] Socket 필터 주입 완료 → ${path.relative(ROOT, filePath)}`);
  return true;
}

function main() {
  const src = resolveFrontendSrc();
  console.log(`[build-frontend] 원본: ${src}`);
  console.log(`[build-frontend] 출력: ${OUT_DIR}`);

  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }
  copyDir(src, OUT_DIR);

  const commonJs = path.resolve(OUT_DIR, 'third-party/front_end/core/common/common.js');
  if (!fs.existsSync(commonJs)) {
    throw new Error(`복사 후 common.js 경로를 찾지 못함: ${commonJs}`);
  }

  patchCommonJs(commonJs);

  console.log('[build-frontend] Done');
}

main();
