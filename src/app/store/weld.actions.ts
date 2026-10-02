import { createAction, props } from '@ngrx/store'
import type {
  AuditEvent,
  BatchSnapshot,
  BlockReason,
  InspectionPlan,
  RevisionBatch,
  RevisionDraft,
  Weld,
  WeldMapping,
  WeldStatus,
} from '../types'

export const loadWelds = createAction('[Weld] Load')
export const loadWeldsSuccess = createAction(
  '[Weld API] Load Success',
  props<{ welds: Weld[]; plans: InspectionPlan[]; batches: RevisionBatch[]; drafts: RevisionDraft[]; blocks: BlockReason[]; snapshots: Record<string, BatchSnapshot>; audit: AuditEvent[] }>(),
)
export const selectWeld = createAction('[Weld] Select', props<{ id: string }>())
export const filterStatus = createAction('[Weld] Filter Status', props<{ status: string }>())
export const advanceWeld = createAction('[Weld] Advance', props<{ id: string; status: WeldStatus }>())
export const createPlan = createAction('[Inspection] Create Plan', props<{ plan: InspectionPlan }>())

/** 模拟现场处理：清除某个阻断原因（待映射补录 / 暂停区恢复） */
export const resolveBlock = createAction('[Block] Resolve', props<{ id: string }>())

/** 深化员保存自己的 B 版确认草稿（始终保留，不互相覆盖） */
export const saveRevisionDraft = createAction('[Revision] Save Draft', props<{ draft: RevisionDraft }>())

/**
 * 提交换版确认。两个深化员同时提交时以提交顺序裁决：
 * 先到者的换版结果生效，后到者保留改动并收到冲突。
 */
export const submitRevision = createAction(
  '[Revision] Submit',
  props<{ draftId: string; batch: RevisionBatch; mapping: WeldMapping[] }>(),
)
export const revisionWon = createAction('[Revision] Won', props<{ draftId: string }>())
export const revisionConflict = createAction(
  '[Revision] Conflict',
  props<{ draftId: string; winnerBatchId: string; winnerBy: string }>(),
)

/** 模拟检测计划写入失败，随后从已确认条目恢复 */
export const planWriteFailed = createAction('[Plan] Write Failed', props<{ planId: string; detail: string }>())
export const recoverPlanFromConfirmed = createAction('[Plan] Recover From Confirmed', props<{ planId: string }>())

/** 签字锁定当前工作批次，生成只读快照 */
export const lockBaseline = createAction('[Approval] Lock Baseline')
/** 按批次查看（锁定批次永远读自己的快照） */
export const viewBatch = createAction('[Batch] View', props<{ batchId: string }>())
