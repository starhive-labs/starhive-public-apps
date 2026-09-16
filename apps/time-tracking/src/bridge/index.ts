/**
 * `@starhive/bridge` — the SDK an app bundle loads inside a Starhive iframe.
 *
 * Imperative usage:
 *   const starhive = createBridge()
 *   await starhive.ready
 *   await starhive.objects.create('timeEntry', [...])
 *
 * React usage:
 *   const { workspaceId } = useStarhiveContext()
 *   const { data } = useObjectQuery('select * from "timeEntry"')
 */
export { createBridge, StarhiveBridgeError } from './bridge'
export type {
  BridgeFetchResponse,
  CreateBridgeOptions,
  StarhiveBridge,
  WriteOptions,
} from './bridge'

export {
  StarhiveProvider,
  useAttribute,
  useAttributes,
  useAutoResize,
  useBridge,
  useConfig,
  useMacroState,
  useNavigate,
  useObject,
  useObjectAggregate,
  useObjectQuery,
  useObjects,
  useStarhiveContext,
  useTheme,
  useToast,
  useTransitions,
  useType,
  useTypeById,
  useTypes,
} from './react'
export type {
  UseAggregateResult,
  UseAttributeResult,
  UseAttributesResult,
  UseConfigResult,
  UseMacroStateResult,
  UseObjectQueryResult,
  UseObjectResult,
  UseObjects,
  UseTransitionsResult,
  UseTypeResult,
  UseTypesResult,
} from './react'

/**
 * Pure lookup helpers over the shapes above. Address an attribute by its manifest `key`, not by
 * display name — a name is a string an admin can change, a key is identity.
 */
export {
  attributeBy,
  attributeByKey,
  attributeByName,
  BRIDGE_PROTOCOL_VERSION,
  displayOf,
  rawValueOf,
  typeKeyOf,
  valuesOf,
} from './protocol'

// Re-export the protocol surface apps commonly need for typing.
export type {
  BridgeAggregateOperation,
  BridgeAggregateRequest,
  BridgeAggregateResult,
  BridgeAttribute,
  BridgeAttributeConfiguration,
  BridgeAttributeInput,
  BridgeAttributeValue,
  BridgeAttributeValues,
  BridgeFetchInit,
  BridgeLocationDetails,
  BridgeMediaDetails,
  BridgeNumberFormatterType,
  BridgeObject,
  BridgeQueryResult,
  BridgeReferenceDetails,
  BridgeRemote,
  BridgeSlaDetails,
  BridgeStateColor,
  BridgeStateDetails,
  BridgeTransition,
  BridgeTransitionsResult,
  BridgeType,
  BridgeTypeIcon,
  BridgeTypeRef,
  BridgeUserDetails,
  BridgeWorkflowState,
  HostContext,
  SlotKind,
  StarhiveTheme,
  StarhiveUser,
  ToastVariant,
} from './protocol'
