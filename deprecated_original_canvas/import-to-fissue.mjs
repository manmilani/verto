#!/usr/bin/env node
/**
 * One-off migration: deprecated Rustybu canvas → fissue tickets in this repo's .fissue project.
 *
 *   node deprecated_original_canvas/import-to-fissue.mjs [--dry-run]
 *
 * Mapping:
 *   Journey     → ticket, issueType=Vertical; outcome → DESC block; persona → personas;
 *                 journeyPriorities rank → priority 1..n (unranked → 9); steps → plain
 *                 "Original map steps" section (not RAW_REQ, so they don't duplicate nodes).
 *   Node        → ticket, issueType=Task; desc → DESC block; deps → blockedBy.
 *   Node.verts  → the journey is blockedBy the node.
 *   Status      → missing=Todo, designed=Designed, partial=In Progress, done=Done + CLOSED.
 *   Black box   → severity:<level> label + "Black box" body section on its core node(s).
 *
 * Refuses to run when the fissue project already has tickets. Env: FISSUE_ROOT targets
 * another fissue project (default: this repo); FISSUE_CLI is the fissue.mjs path if
 * `npm root -g` doesn't find it.
 */
import { execFileSync, execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const dryRun = process.argv.includes('--dry-run')
const projectRoot = process.env.FISSUE_ROOT ?? repoRoot

// ---------------------------------------------------------------- canvas data

const source = readFileSync(join(here, 'rustybu-vertical-delivery-map.canvas.tsx'), 'utf8')
const session = JSON.parse(readFileSync(join(here, 'rustybu-vertical-delivery-map.canvas.data.json'), 'utf8'))

/** The array literal assigned by `const <name>... = [ ... ];`, evaluated as plain JS data. */
function arrayLiteral(name) {
  const decl = new RegExp(`const ${name}\\b[^=]*=`).exec(source)
  if (!decl) throw new Error(`array literal ${name} not found`)
  const start = source.indexOf('[', decl.index + decl[0].length)
  let depth = 0
  let quote = null
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '[') depth++
    else if (ch === ']' && --depth === 0) return new Function(`return ${source.slice(start, i + 1)}`)()
  }
  throw new Error(`array literal ${name} not found`)
}

const JOURNEYS = arrayLiteral('JOURNEYS')
const NODES = arrayLiteral('NODES')
const BLACK_BOXES = arrayLiteral('BLACK_BOXES')

const STATUS = {
  missing: { status: 'Todo', label: 'Black box' },
  designed: { status: 'Designed', label: "Spec'd · not built" },
  partial: { status: 'In Progress', label: 'Partial' },
  done: { status: 'Done', label: 'Implemented' },
}

/** Canvas persona strings, split into individual personas. */
const PERSONAS = {
  'business-setup': ['New centre'],
  onboarding: ['Parent', 'Director'],
  compliance: ['Director', 'Licensing'],
  attendance: ['Educator'],
  placement: ['Director'],
  billing: ['Admin', 'Parent'],
  staff: ['Manager'],
  communication: ['Parent', 'Educator'],
  development: ['Educator', 'Parent'],
  health: ['Educator', 'Parent'],
  nutrition: ['Cook', 'Educator'],
  inventory: ['Admin'],
  bi: ['Owner'],
  platform: ['Platform', 'Owner'],
  'saas-ops': ['Rustybu staff'],
  'customer-support': ['Rustybu support', 'Customer'],
}

/** Each black box's core node(s). */
const BLACK_BOX_NODES = {
  'AI-powered self-serve business onboarding & data migration': ['wizard', 'publicdata', 'bulkimport'],
  'Setup-definition depth (plans & cycles)': ['billingcycles', 'payrollcycles', 'mealplans'],
  'Rustybu SaaS back-office / admin console': ['adminconsole', 'tenantdir', 'superadmin'],
  'Subscription monetization (billing customers)': ['subplans', 'subbilling', 'subpaycollect'],
  'Customer support & success stack': ['kb', 'supportchannel', 'ticketing'],
  'File / document storage (S3-style) layer': ['filestore'],
  'Multi-channel notification delivery': ['notif'],
  'Application intake + staged approval workflow': ['formbuilder', 'appintake', 'approval'],
  'Placement & projection engine (lib/placement + /compliance/project)': ['projection', 'scorer'],
  'Payments & recurring billing engine': ['paygateway', 'invoicegen'],
  'Payroll pipeline': ['timesheets', 'payrollexport'],
  'Mobile / PWA + offline sync': ['mobile'],
  'Subsidy lifecycle beyond the estimator': ['subsidylifecycle'],
  'RBAC enforcement + PIPEDA / encryption': ['rbac', 'security'],
  'Multi-site / franchise (organizations) layer': ['multisite'],
  'Green-field secondary domains': ['curriculum', 'mealplans', 'inventoryitems'],
}
const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2 }

// ---------------------------------------------------------------- validation

const nodeById = new Map(NODES.map(n => [n.id, n]))
const journeyIds = new Set(JOURNEYS.map(j => j.id))
const problems = []
for (const n of NODES) {
  for (const d of n.deps) if (!nodeById.has(d)) problems.push(`node ${n.id}: unknown dep ${d}`)
  for (const v of n.verts) if (!journeyIds.has(v)) problems.push(`node ${n.id}: unknown journey ${v}`)
}
for (const j of JOURNEYS) if (!PERSONAS[j.id]) problems.push(`journey ${j.id}: no persona mapping`)
for (const b of BLACK_BOXES) {
  const ids = BLACK_BOX_NODES[b.system]
  if (!ids) problems.push(`black box "${b.system}": no node mapping`)
  else for (const id of ids) if (!nodeById.has(id)) problems.push(`black box "${b.system}": unknown node ${id}`)
}
for (const id of session.journeyPriorities) if (!journeyIds.has(id)) problems.push(`priority: unknown journey ${id}`)
if (problems.length) throw new Error(`canvas data problems:\n  ${problems.join('\n  ')}`)

// ---------------------------------------------------------------- derived

const blackBoxesByNode = new Map()
for (const b of BLACK_BOXES) {
  for (const id of BLACK_BOX_NODES[b.system]) {
    if (!blackBoxesByNode.has(id)) blackBoxesByNode.set(id, [])
    blackBoxesByNode.get(id).push(b)
  }
}

/** Nodes with every dep before its dependents, so blockedBy can be set at creation. */
function topoOrder() {
  const out = []
  const seen = new Set()
  const visit = id => {
    if (seen.has(id)) return
    seen.add(id)
    nodeById.get(id).deps.forEach(visit)
    out.push(nodeById.get(id))
  }
  NODES.forEach(n => visit(n.id))
  return out
}

const desc = text => `<!-- DESC:BEGIN -->\n${text}\n<!-- DESC:END -->`
const canvasId = id => `<!-- canvas-id: ${id} -->`

function nodeBody(n) {
  const parts = [desc(n.desc)]
  const boxes = blackBoxesByNode.get(n.id) ?? []
  if (boxes.length) {
    parts.push('## Black box', ...boxes.map(b => `**${b.system}** (${b.severity}) — ${b.whats}`))
  }
  parts.push(canvasId(n.id))
  return parts.join('\n\n') + '\n'
}

function journeyBody(j) {
  const steps = j.steps.map(s => `- **${s.name}** — ${STATUS[s.status].label} — ${s.note}`)
  return [
    desc(j.outcome),
    `**Persona (canvas):** ${j.persona}`,
    '## Original map steps',
    "Reference only: the canvas's per-journey view. The work is tracked by the tickets this vertical is blocked by.",
    steps.join('\n'),
    canvasId(j.id),
  ].join('\n\n') + '\n'
}

function statusArgs(status) {
  const s = STATUS[status]
  const args = ['--set', `status=${s.status}`]
  if (status === 'done') args.push('--set', 'state=CLOSED', '--set', 'stateReason=COMPLETED')
  return args
}

// ---------------------------------------------------------------- fissue

const cli = process.env.FISSUE_CLI ?? join(execSync('npm root -g').toString().trim(), '@fissue', 'cli', 'dist', 'fissue.mjs')

function fissue(...args) {
  if (dryRun && ['create', 'field'].includes(args[0])) {
    console.log(`[dry-run] fissue ${args.join(' ')}`)
    return { id: `DRY-${++dryCount}` }
  }
  const out = execFileSync(process.execPath, [cli, ...args, '--json'], { cwd: projectRoot, encoding: 'utf8' })
  const result = JSON.parse(out)
  for (const w of result.warnings ?? []) console.warn(`  warning: ${typeof w === 'string' ? w : JSON.stringify(w)}`)
  return result
}
let dryCount = 0

const existingCount = fissue('list', '--fields', 'id').tickets.length
if (existingCount > 0) throw new Error(`the fissue project already has ${existingCount} ticket(s); import into an empty project`)

const personaOptions = [...new Set(Object.values(PERSONAS).flat())]
fissue('field', 'add', 'priority', '--set', 'type=number', '--set', 'default=5',
  '--set', 'description=Priority 1 (most important) to 9 (least); Verto default 5')
fissue('field', 'add', 'personas', '--set', 'type=select', '--set', 'isArray=true',
  ...personaOptions.flatMap(p => ['--set', `options=${p}`]), '--set', 'description=Personas a vertical serves')
fissue('field', 'update', 'status', ...['Todo', 'Designed', 'In Progress', 'Done'].flatMap(o => ['--set', `options=${o}`]))

const tmp = mkdtempSync(join(tmpdir(), 'canvas-import-'))
const bodyFile = (key, text) => {
  const f = join(tmp, `${key}.md`)
  writeFileSync(f, text)
  return f
}

const ticketOf = new Map()
try {
  for (const n of topoOrder()) {
    const boxes = blackBoxesByNode.get(n.id) ?? []
    const worst = boxes.map(b => b.severity).sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b])[0]
    const { id } = fissue('create', '--title', n.label, '--set', 'issueType=Task',
      ...statusArgs(n.status),
      ...(worst ? ['--set', `labels=severity:${worst.toLowerCase()}`] : []),
      ...n.deps.flatMap(d => ['--set', `blockedBy=${ticketOf.get(d)}`]),
      '--body-file', bodyFile(n.id, nodeBody(n)))
    ticketOf.set(n.id, id)
    console.log(`${id}  task      ${n.label}`)
  }

  for (const j of JOURNEYS) {
    const rank = session.journeyPriorities.indexOf(j.id)
    const blockers = NODES.filter(n => n.verts.includes(j.id)).map(n => ticketOf.get(n.id))
    const { id } = fissue('create', '--title', j.name, '--set', 'issueType=Vertical',
      '--set', `priority=${rank >= 0 ? rank + 1 : 9}`,
      ...PERSONAS[j.id].flatMap(p => ['--set', `personas=${p}`]),
      ...blockers.flatMap(b => ['--set', `blockedBy=${b}`]),
      '--body-file', bodyFile(j.id, journeyBody(j)))
    ticketOf.set(j.id, id)
    console.log(`${id}  vertical  ${j.name}  (priority ${rank >= 0 ? rank + 1 : 9}, ${blockers.length} blockers)`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`\nCreated ${NODES.length} tasks and ${JOURNEYS.length} verticals.`)
if (!dryRun) fissue('sync')
