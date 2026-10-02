export type WeldStatus = '待检测' | '合格' | '返修中' | '待复检' | '已关闭'
export type DefectLevel = 'Ⅰ级' | 'Ⅱ级' | 'Ⅲ级' | 'Ⅳ级'
export type DrawingVersion = 'A' | 'B'
export type MappingStatus = '已映射' | '待映射'
export type PlanState = '待执行' | '执行中' | '已完成'

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
  /** 节点号（深化图节点命名），换版时按新节点命名重映射 */
  node: string
  /** 换版映射状态：B 版节点命名中找不到新节点时回填「待映射」，不静默丢失 */
  mappingStatus: MappingStatus
  joint: string
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

export interface InspectionPlan {
  id: string
  date: string
  method: string
  weldIds: string[]
  inspector: string
  state: PlanState
  /** 所属换版批次，随换版重算 */
  batchId: string | null
  /** 未完工计划随换版重算后，含待映射/缺失节点时阻断 */
  blocked: boolean
  blockReason: string | null
}

/** 图纸换版批次：发版时固定图纸号、节点命名与允许施工区 */
export interface DrawingRevision {
  batchId: string
  drawingNo: string
  version: DrawingVersion
  nodeNaming: string
  allowedZones: string[]
  releasedAt: string
  releasedBy: string
  /** 批次修订号，并发提交时作为先到先得的比对令牌 */
  revision: number
  status: '已发布' | '已锁定'
}

/** 两个深化员同时提交 B 版确认时的并发冲突：先到结果生效，后到者保留自己的改动并看到冲突 */
export interface RevisionConflict {
  batchId: string
  submittedBy: string
  basedOnRevision: number
  currentRevision: number
  reason: string
  theirNodeNaming: string
  theirAllowedZones: string[]
  /** 异议改动是否被保留 */
  kept: boolean
}

/** 已签字锁定的批次快照：按原图纸号、节点命名、焊缝与计划原样查看 */
export interface LockedSnapshot {
  batchId: string
  drawingNo: string
  version: DrawingVersion
  revision: number
  nodeNaming: string
  allowedZones: string[]
  lockedAt: string
  lockedBy: string
  welds: Weld[]
  plans: InspectionPlan[]
}

export interface AuditEvent {
  id: string
  time: string
  actor: string
  action: string
  target: string
  detail: string
}
