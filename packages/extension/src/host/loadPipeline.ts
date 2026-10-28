import type { DeliveryMapBundle, MissingField, VertoAdapter, VertoChange, VertoGraph } from '@verto/core'
import type { VertoConfig, DisplayStatusGroup, PriorityOptionHints, FieldMappings } from '@verto/config'
import {
  buildPriorityOptionHints,
  buildStatusUniverse,
  shouldShowOthersColumn,
  buildDisplayStatusGroupTooltips,
  statusOptionsFor,
  withoutMappings,
  writableLevels,
} from '@verto/config'
import { runHostPipeline, type ChangeStatus } from '@verto/text-parser'
import { getAdapter, type AdapterEnv } from './adapterRegistry.js'

/** One field-check finding, with the other kinds where the name exists (DESIGN.md §4.6.4). */
export function describeMissingField(m: MissingField): string {
  const problem = m.reason === 'missing' ? `not found in ${m.scope}` : 'not supported'
  const hint = m.suggestedKinds.length > 0
    ? ` — found as kind ${m.suggestedKinds.map(k => `"${k}"`).join(', ')}`
    : ''
  return `${m.key}: kind "${m.kind}" "${m.field}" ${problem}${hint}`
}

/** One line describing mappings skipped by the field check (scripts). */
export function formatSkippedFields(skipped: MissingField[]): string {
  return `Verto: skipped field mappings: ${skipped.map(describeMissingField).join('; ')}`
}

/** A project as read from the tracker; views are built from it without reloading. */
export interface LoadedProject {
  adapter: VertoAdapter<VertoConfig>
  graph: VertoGraph
  /** The config the load used (skipped mappings dropped). */
  config: VertoConfig
  /** The config before any skip: what writes use. */
  fullConfig: VertoConfig
  projectName: string
  /** Status option names from the tracker. */
  trackerStatusOptions: string[]
  fieldMappings: FieldMappings | undefined
  skipped: MissingField[]
}

export interface ProjectView {
  bundle: DeliveryMapBundle
  changeStates: ChangeStatus[]
  displayStatusGroups: DisplayStatusGroup[]
  showOthersColumn: boolean
  displayStatusGroupTooltips: Record<string, string>
  projectName: string
  priorityOptionHints: PriorityOptionHints
  /** Status values the panel can offer (tracker options read through the status mapping). */
  statusOptions: string[]
  /** Priority levels a tracker value reads back as; null = every level. */
  writableLevels: number[] | null
}

/**
 * Check, then load. When the field check finds mappings that can't be read, `confirmSkip`
 * decides: `true` skips them and loads, `false` cancels (result `null`). Without it they are
 * skipped (non-interactive scripts, and the reload before a write).
 */
export async function loadProjectGraph(
  loadedConfig: VertoConfig,
  env: AdapterEnv,
  confirmSkip?: (missing: MissingField[]) => Promise<boolean>,
): Promise<LoadedProject | null> {
  const adapter = await getAdapter(loadedConfig, env)
  const skipped = (await adapter.checkFields?.(loadedConfig)) ?? []
  if (skipped.length > 0 && confirmSkip && !(await confirmSkip(skipped))) return null
  const config = withoutMappings(loadedConfig, skipped.map(m => m.key))

  const fieldMappings = adapter.fieldMappings?.(config) as FieldMappings | undefined
  const [graph, projectName, trackerStatusOptions] = await Promise.all([
    adapter.loadProject(config),
    adapter.projectTitle?.(config) ?? Promise.resolve(config.adapter),
    adapter.fetchStatusOptions?.(config) ?? Promise.resolve([]),
  ])
  return { adapter, graph, config, fullConfig: loadedConfig, projectName, trackerStatusOptions, fieldMappings, skipped }
}

/** The view of a load with the draft applied (DESIGN.md §4.6.11). Pure: the load is not changed. */
export function buildView(loaded: LoadedProject, changes: VertoChange[], parsedEnabled: boolean): ProjectView {
  const { config, fieldMappings } = loaded
  const { bundle, changeStates } = runHostPipeline(loaded.graph, { parsedEnabled, changes, fieldMappings })
  const displayStatusGroups = config.ui?.displayStatusGroups ?? []
  const statusUniverse = buildStatusUniverse(bundle.graph.nodes, loaded.trackerStatusOptions)
  const showOthersColumn = shouldShowOthersColumn(displayStatusGroups, statusUniverse, fieldMappings)
  return {
    bundle,
    changeStates,
    displayStatusGroups,
    showOthersColumn,
    displayStatusGroupTooltips: buildDisplayStatusGroupTooltips(
      displayStatusGroups,
      statusUniverse,
      fieldMappings,
      showOthersColumn,
    ),
    projectName: loaded.projectName,
    priorityOptionHints: buildPriorityOptionHints(fieldMappings?.priority),
    statusOptions: statusOptionsFor(loaded.trackerStatusOptions, fieldMappings?.status),
    writableLevels: writableLevels(fieldMappings?.priority),
  }
}

/** Load and build the view without a draft (scripts). */
export async function runPipeline(
  loadedConfig: VertoConfig,
  env: AdapterEnv,
  parsedEnabled: boolean,
  confirmSkip?: (missing: MissingField[]) => Promise<boolean>,
): Promise<(ProjectView & { skipped: MissingField[] }) | null> {
  const loaded = await loadProjectGraph(loadedConfig, env, confirmSkip)
  return loaded && { ...buildView(loaded, [], parsedEnabled), skipped: loaded.skipped }
}
