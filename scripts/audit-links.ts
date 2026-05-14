#!/usr/bin/env bun
/**
 * Audit markdown links in the castle. Bun-based replacement / superset of `audit-links.sh`.
 *
 * Walks every .md under docs/, plus every CLAUDE.md (repo root, packages/<pkg>/, demos/<demo>/),
 * and reports three issue kinds:
 *
 *   BROKEN     — link target does not exist on disk.
 *   UNTRACKED  — link target exists, but is not git-tracked while the source IS.
 *                Castle (committed) → working memory (uncommitted) violates the one-way
 *                linkage rule. Fix: `git add` the target, or rework the link.
 *   ANCHOR     — link has a #fragment but the target file has no heading whose
 *                GitHub-style slug matches.
 *
 * Skips:
 *   - External schemes: http(s)://, mailto:, tel:.
 *   - Pure #anchor links (no path component).
 *   - Links inside fenced code blocks (``` fences; leading whitespace permitted).
 *   - UNTRACKED check is skipped when the source file is itself untracked
 *     (working memory can link wherever) and for directory or symlink targets.
 *
 * Output: tree-grouped by source file, with line numbers, ANSI color when stdout is a TTY.
 *
 * Exit code: 0 = clean, 1 = issues found, 2 = setup error (no git repo).
 */

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// ---------- Setup -----------------------------------------------------------

function gitRepoRoot(): string | null {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' })
  if (r.status !== 0) return null
  return r.stdout.trim()
}

function gitLsFiles(cwd: string): Set<string> {
  const r = spawnSync('git', ['ls-files'], { cwd, encoding: 'utf-8' })
  if (r.status !== 0) return new Set()
  return new Set(r.stdout.split('\n').filter(Boolean))
}

const repoRoot = gitRepoRoot()
if (!repoRoot) {
  console.error('audit-links: not inside a git repo')
  process.exit(2)
}
const tracked = gitLsFiles(repoRoot)

// ---------- ANSI ------------------------------------------------------------

const useColor = !!process.stdout.isTTY
const ansi = (code: number, t: string): string => (useColor ? `\x1b[${code}m${t}\x1b[0m` : t)
const bold = (t: string) => ansi(1, t)
const dim = (t: string) => ansi(2, t)
const red = (t: string) => ansi(31, t)
const yellow = (t: string) => ansi(33, t)
const cyan = (t: string) => ansi(36, t)

// ---------- Heading slugs (GitHub-flavored) --------------------------------

function slugify(heading: string): string {
  // GitHub-flavored: lowercase, drop punctuation except letters/digits/whitespace/hyphens,
  // then replace each whitespace character with a hyphen (do not collapse runs — em-dash
  // removal leaves consecutive spaces which become consecutive hyphens, matching GitHub).
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')
}

const headingsCache = new Map<string, Set<string>>()

function getHeadings(absPath: string): Set<string> {
  const cached = headingsCache.get(absPath)
  if (cached) return cached
  const slugs = new Set<string>()
  if (!existsSync(absPath)) {
    headingsCache.set(absPath, slugs)
    return slugs
  }
  const counts = new Map<string, number>()
  const content = readFileSync(absPath, 'utf-8')
  let inCode = false
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    const m = /^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/.exec(line)
    if (!m) continue
    const baseSlug = slugify(m[2].trim())
    if (!baseSlug) continue
    const count = counts.get(baseSlug) ?? 0
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`
    slugs.add(slug)
    counts.set(baseSlug, count + 1)
  }
  headingsCache.set(absPath, slugs)
  return slugs
}

// ---------- File walk -------------------------------------------------------

function collectFiles(): string[] {
  const out: string[] = []
  const walk = (relDir: string): void => {
    let entries
    try {
      entries = readdirSync(join(repoRoot!, relDir), { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const rel = join(relDir, ent.name)
      if (ent.isDirectory()) walk(rel)
      else if (ent.isFile() && ent.name.endsWith('.md')) out.push(rel)
    }
  }
  walk('docs')
  if (existsSync(join(repoRoot!, 'CLAUDE.md'))) out.push('CLAUDE.md')
  for (const top of ['packages', 'demos']) {
    let entries
    try {
      entries = readdirSync(join(repoRoot!, top), { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue
      const rel = join(top, ent.name, 'CLAUDE.md')
      if (existsSync(join(repoRoot!, rel))) out.push(rel)
    }
  }
  return out.sort()
}

// ---------- Link extraction ------------------------------------------------

interface Link {
  line: number
  raw: string
  path: string
  anchor: string
}

const linkRegex = /\[[^\]]+\]\(([^)\s]+)\)/g

function extractLinks(absPath: string): Link[] {
  const out: Link[] = []
  const content = readFileSync(absPath, 'utf-8')
  const lines = content.split('\n')
  let inCode = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (/^\s*```/.test(line)) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    let m
    linkRegex.lastIndex = 0
    while ((m = linkRegex.exec(line)) !== null) {
      const url = m[1]!
      if (/^(?:https?|mailto|tel):/.test(url)) continue
      if (url.startsWith('#')) continue
      const hashIdx = url.indexOf('#')
      const path = hashIdx === -1 ? url : url.slice(0, hashIdx)
      const anchor = hashIdx === -1 ? '' : url.slice(hashIdx + 1)
      if (!path) continue
      out.push({ line: i + 1, raw: m[0], path, anchor })
    }
  }
  return out
}

// ---------- Per-link checks -------------------------------------------------

type IssueKind = 'BROKEN' | 'UNTRACKED' | 'ANCHOR'
interface Issue {
  kind: IssueKind
  detail: string
}

function repoRel(absPath: string): string {
  const prefix = repoRoot! + '/'
  return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath
}

function check(link: Link, sourceRel: string): Issue[] {
  const issues: Issue[] = []

  const sourceAbs = join(repoRoot!, sourceRel)
  const target = link.path.startsWith('/')
    ? join(repoRoot!, link.path)
    : resolve(dirname(sourceAbs), link.path)
  const targetRel = repoRel(target)

  if (!existsSync(target)) {
    issues.push({ kind: 'BROKEN', detail: targetRel })
    return issues
  }

  let isFile = false
  let isSymlink = false
  try {
    const stat = lstatSync(target)
    isFile = stat.isFile()
    isSymlink = stat.isSymbolicLink()
  } catch {
    // unreachable given existsSync above, but defensively skip further checks
    return issues
  }

  // UNTRACKED: source tracked, target tracked-status mismatch (and target is a regular file).
  if (tracked.has(sourceRel) && isFile && !isSymlink && !tracked.has(targetRel)) {
    issues.push({ kind: 'UNTRACKED', detail: targetRel })
  }

  // ANCHOR: anchor present, target is a markdown file, no matching heading.
  if (link.anchor && isFile && !isSymlink && target.endsWith('.md')) {
    const headings = getHeadings(target)
    if (!headings.has(link.anchor)) {
      issues.push({ kind: 'ANCHOR', detail: `${targetRel}#${link.anchor}` })
    }
  }

  return issues
}

// ---------- Run -------------------------------------------------------------

interface FileFinding {
  source: string
  links: { line: number; raw: string; issues: Issue[] }[]
}

const findings: FileFinding[] = []
let totalIssues = 0

for (const file of collectFiles()) {
  const abs = join(repoRoot, file)
  const linksWithIssues: FileFinding['links'] = []
  for (const link of extractLinks(abs)) {
    const issues = check(link, file)
    if (issues.length > 0) {
      linksWithIssues.push({ line: link.line, raw: link.raw, issues })
      totalIssues += issues.length
    }
  }
  if (linksWithIssues.length > 0) {
    findings.push({ source: file, links: linksWithIssues })
  }
}

// ---------- Output ---------------------------------------------------------

if (findings.length === 0) {
  console.log('audit-links: all links resolve')
  process.exit(0)
}

const issueLabel: Record<IssueKind, string> = {
  BROKEN: red('BROKEN'),
  UNTRACKED: yellow('UNTRACKED'),
  ANCHOR: yellow('ANCHOR'),
}

for (const f of findings) {
  console.log(bold(cyan(f.source)) + ':')
  for (const l of f.links) {
    console.log(`  ${dim(`${l.line}:`)} ${l.raw}`)
    for (const issue of l.issues) {
      console.log(`    ${issueLabel[issue.kind]} → ${issue.detail}`)
    }
  }
  console.log()
}

console.log(`audit-links: ${totalIssues} link issue(s) across ${findings.length} file(s)`)
process.exit(1)
