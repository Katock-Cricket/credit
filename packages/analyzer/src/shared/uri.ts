/**
 * uri 归一化（P2 修复）。
 *
 * **问题**：同一个文件在不同来源里形态不同 ——
 * - `behaviors` 采集：`D:/Workspace/MusicStorm/src-tauri/src/codec_probe.rs`、
 *   甚至 `file:///d%3A/Workspace/MusicStorm/README.md`（URL 编码）
 * - `git diff` 输出：`src-tauri/src/codec_probe.rs`（仓库相对路径）
 *
 * 初版直接拿 git 的相对路径去查阅读索引（以 behaviors 的绝对 uri 为 key），
 * 结果**全部查不到** → 「阅读覆盖 PR / 编辑覆盖 PE / 光标游走 NC」恒为 0，
 * 测试用例也提取不到。故在此统一收口。
 */

/**
 * 规范 uri：剥掉宿主加的协议前缀与 URL 编码，还原成"真实文件路径"（保留原始大小写，便于展示）。
 *
 * 实测出现的三种形态：
 * - `D:/Workspace/MusicStorm/src-tauri/src/codec_probe.rs`（普通文件）
 * - `file:///d%3A/Workspace/MusicStorm/README.md`（URL 编码）
 * - `inmemory://diff-original/1788334885302/D%3A/Workspace/.../use-player.tsx`
 *   ← **Bitfun 的 Diff 查看器**。用户"看 diff"的行为全在这个命名空间下，
 *     初版没处理它，导致这三个文件的阅读记录与核心 Diff 完全对不上（验视分恒为 0）。
 */
export function canonicalUri(uri: string): string {
  let u = String(uri ?? "").trim();

  if (u.startsWith("inmemory://")) {
    // inmemory://<形态>/<时间戳>/<被编码的真实路径>
    const seg = u.slice("inmemory://".length).split("/");
    u = seg.slice(2).join("/");
  } else if (u.startsWith("file://")) {
    u = u.slice("file://".length).replace(/^\//, "");
  }

  try {
    u = decodeURIComponent(u);
  } catch {
    /* 非法编码 → 原样 */
  }
  // Windows: /d:/xxx → d:/xxx
  u = u.replace(/^\/([a-zA-Z]:)/, "$1");
  return u.replace(/\\/g, "/");
}

/** 归一化（用于比较）：规范后再小写 —— Windows 路径不区分大小写 */
export function normUri(uri: string): string {
  return canonicalUri(uri).toLowerCase();
}

/** 是否为绝对路径（含盘符或以 / 开头） */
export function isAbsolutePath(uri: string): boolean {
  const c = canonicalUri(uri);
  return /^[a-zA-Z]:\//.test(c) || c.startsWith("/");
}

/**
 * 把 git 输出的**相对路径**解析回 behaviors 中的**绝对 uri**。
 *
 * **必须优先选绝对路径**：实测 behaviors 里同一个文件同时存在绝对与相对两种形态
 * （如 `D:/Workspace/.../codec_probe.rs` 与 `src-tauri/codec_probe.rs`），
 * 若匹配到相对的那个，coreDiff 的 key 就会与阅读轨迹（多为绝对形态）对不上。
 */
export function resolveGitUri(gitUri: string, knownUris: readonly string[]): string {
  const g = normUri(gitUri);
  if (!g) return gitUri;

  const cands = knownUris.filter((u) => normUri(u) === g || normUri(u).endsWith(`/${g}`));
  if (cands.length === 0) return gitUri;
  const abs = cands.find((u) => isAbsolutePath(u));
  return canonicalUri(abs ?? cands[0]!);
}

/**
 * 把同一文件的**多种 uri 形态归并到一个"主 uri"**（优先绝对路径）。
 *
 * 实测同一文件会出现：`D:/W/.../a.rs`、`d:/W/.../a.rs`、`src/a.rs`、`?/D:/W/.../a.rs`。
 * 不归并的话，阅读轨迹会被切碎到多个 key，每个 key 只留下一部分行号，
 * 覆盖率怎么算都偏低（实测表现为"覆盖 0%"）。
 *
 * @returns `原始 uri → 主 uri` 的映射
 */
export function buildUriAlias(uris: readonly string[]): Map<string, string> {
  const canon = uris.map((raw) => ({ raw, c: canonicalUri(raw) }));
  const abs = canon.filter((x) => isAbsolutePath(x.c));
  const alias = new Map<string, string>();

  for (const x of canon) {
    if (isAbsolutePath(x.c)) {
      alias.set(x.raw, x.c);
      continue;
    }
    // 相对路径 → 归属到以它结尾的绝对路径
    const host = abs.find((a) => normUri(a.c).endsWith(`/${normUri(x.c)}`));
    alias.set(x.raw, host ? host.c : x.c);
  }
  return alias;
}

/**
 * 从行为流中收集全部文件 uri（去重，**已规范化**）。
 * 规范化是必需的：否则 `inmemory://` 与 `D:/` 两种形态会被当成两个不同文件。
 */
export function collectFileUris(behaviors: readonly { object?: { kind?: string; uri?: string } }[]): string[] {
  const set = new Set<string>();
  for (const b of behaviors) {
    if (b.object?.kind === "file" && b.object.uri) set.add(canonicalUri(b.object.uri));
  }
  return [...set];
}
