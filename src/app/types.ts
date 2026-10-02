export type WeldStatus = '待检测' | '合格' | '返修中' | '待复检' | '已关闭'
export type DefectLevel = 'Ⅰ级' | 'Ⅱ级' | 'Ⅲ级' | 'Ⅳ级'
export type MappingState = '已映射' | '待映射'
export type ZoneState = '允许' | '暂停'
export type BatchStatus = '已锁定' | '待确认' | '已生效'
export type RecomputeFlag = '已重算' | '已阻断' | '需重新排期'
export type EntryWriteState = '已确认' | '待写入' | '写入失败' | '已恢复'
export type BlockSeverity = '阻断' | '预警'
export type DraftStatus = '保留' | '已采纳'

export interface Defect {
  id: string
  position: number
  type: string
  length: number
  level: DefectLevel
  method: string
  report: string
}

export interface Weld {
  id: string
  drawing: string
  component: string
  /** 坡口/焊缝形式 */
  joint: string
  /** 当前生效节点号（换版后按批次重命名） */
  node: string
  nodeA: string
  nodeB?: string
  /** 所属允许施工区 */
  zone: string
  zoneState: ZoneState
  /** 写入该焊缝当前数据的换版批次 */
  batchId: string
  mappingState: MappingState
  mappingNote: string
  method: string
  welder: string
  qualification: string
  qualificationValid: boolean
  inspectionRatio: number
  requiredRatio: number
  status: WeldStatus
  x: number
  y: number
  repairs: number
  defects: Defect[]
}

export interface PlanEntry {
  weldId: string
  /** 重算时使用的节点命名快照 */
  node: string
  zone: string
  valid: boolean
  flag?: RecomputeFlag
  blockCode?: string
  blockReason?: string
  writeState: EntryWriteState
}

export interface InspectionPlan {
  id: string
  date: string
  method: string
  inspector: string
  state: '待执行' | '执行中' | '已完成'
  batchId: string
  /** 若计划被某批次重算，记录目标批次号 */
  recomputedFor?: string
  writeState: '正常' | '写入失败'
  entries: PlanEntry[]
  /** 最近一次确认基线，写入失败后从这里恢复 */
  confirmedEntries: PlanEntry[]
}

export interface FrozenNode {
  name: string
  zone: string
  state: ZoneState
  /** 被哪个旧节点更名而来，J-A5 这类取消节点不出现在 B 版名单中 */
  renamedFrom?: string
}

export interface RevisionItem {
  id: string
  type: '图纸号' | '节点命名' | '允许施工区' | '焊缝映射' | '检测计划'
  title: string
  detail: string
  impactWeldIds: string[]
  impactPlanIds: string[]
  /** 阻断该条修订生效的阻断代码，随现场处理动态消除 */
  relatedBlockCodes: string[]
}

export interface RevisionBatch {
  id: string
  fromBatchId?: string
  label: string
  /** 发版时固定的图纸号，换版不改号 */
  drawingNo: string
  scopeDrawings: string[]
  status: BatchStatus
  publishedAt: string
  effectiveAt?: string
  confirmedBy?: string
  /** 发版时固定的节点命名 */
  nodes: FrozenNode[]
  /** 发版时固定的允许施工区 */
  allowedZones: string[]
  zones: Record<string, ZoneState>
  revisionItems: RevisionItem[]
}

/** 焊缝级映射指令：null 表示 B 版没有对应节点，必须回填待映射 */
export interface WeldMapping {
  weldId: string
  fromNode: string
  toNode: string | null
}

export interface RevisionDraft {
  id: string
  label: string
  author: string
  basedOn: string
  createdAt: string
  status: DraftStatus
  batch: RevisionBatch
  mapping: WeldMapping[]
  /** 未抢到换版时保留的冲突说明，改动不被覆盖 */
  conflict?: {
    winnerBatchId: string
    winnerBy: string
    reason: string
    changes: string
  }
}

export interface BlockReason {
  id: string
  severity: BlockSeverity
  scope: '全局' | '焊缝' | '计划'
  refId?: string
  code: string
  message: string
  batchId: string
}

export interface PlanWriteError {
  planId: string
  time: string
  detail: string
  restored: number
}

export interface BatchSnapshot {
  batchId: string
  lockedAt: string
  lockedBy: string
  batch: RevisionBatch
  welds: Weld[]
  plans: InspectionPlan[]
  blocks: BlockReason[]
}

export interface AuditEvent {
  id: string
  time: string
  actor: string
  action: string
  target: string
  detail: string
}
