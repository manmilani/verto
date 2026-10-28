// Types
export type {
  Priority,
  VertoNode,
  VertoEdge,
  VertoGraph,
  DeliveryMapBundle,
} from './types.js'
export { CANONICAL_VERTO_NODE_KEYS } from './types.js'

// Adapter interface
export type { VertoAdapter, MissingField, WriteConfirmation, WriteHooks, WriteResult } from './adapter.js'

// Write-back change model
export type { EditableKey, VertoChange, ChangeState, ImpliedSets } from './changes.js'
export {
  EDITABLE_KEYS,
  TEMP_ID_PREFIX,
  DRAFT_URL_SCHEME,
  isTempId,
  sameTarget,
  upsertChange,
  changeNodeIds,
  discardChanges,
  nextTempId,
  remapNodeIds,
  applyChanges,
  parseChange,
} from './changes.js'

// Algorithms
export { closureFor } from './algorithms/closure.js'
export { isReady, readyNodes } from './algorithms/readiness.js'
export { leverageScores } from './algorithms/leverage.js'
export { deliveryCompleteness, deliveryCompletenessMap, nodeWeight } from './algorithms/completeness.js'
export { globalPriorityRanking } from './algorithms/priority.js'
export type { GlobalPriorityRankingOptions } from './algorithms/priority.js'
export { implementationOrder } from './algorithms/order.js'

// Bundle orchestrator
export { buildDeliveryMapBundle } from './bundle.js'

// Validation
export { validateGraph } from './validation.js'
export type { ValidationIssue, ValidationResult, ValidationErrorType } from './validation.js'
