import { createAction, props } from '@ngrx/store'
import type { DrawingRevision, InspectionPlan, RevisionConflict, Weld, WeldStatus } from '../types'

export const loadWelds = createAction('[Weld] Load')
export const loadWeldsSuccess = createAction('[Weld API] Load Success', props<{ welds: Weld[]; plans: InspectionPlan[] }>())
export const selectWeld = createAction('[Weld] Select', props<{ id: string }>())
export const filterStatus = createAction('[Weld] Filter Status', props<{ status: string }>())
export const advanceWeld = createAction('[Weld] Advance', props<{ id: string; status: WeldStatus }>())
export const createPlan = createAction('[Inspection] Create Plan', props<{ plan: InspectionPlan }>())

/** 深化员提交 B 版确认；baseRevision 为其提交时所依据的批次修订号，先到先得 */
export const releaseRevision = createAction('[Revision] Release', props<{ proposal: DrawingRevision; baseRevision: number; submittedBy: string }>())
export const releaseRevisionSuccess = createAction('[Revision] Release Success', props<{ revision: DrawingRevision }>())
export const releaseRevisionConflict = createAction('[Revision] Release Conflict', props<{ conflict: RevisionConflict }>())
/** 接受先到结果；kept=true 时保留异议改动并留痕 */
export const clearConflict = createAction('[Revision] Clear Conflict', props<{ kept: boolean }>())

/** 计划写入：先乐观写入，服务端拒绝后从已确认条目恢复 */
export const planWriteRequested = createAction('[Inspection] Plan Write Requested', props<{ plan: InspectionPlan }>())
export const planWriteConfirmed = createAction('[Inspection] Plan Write Confirmed', props<{ plan: InspectionPlan }>())
export const planWriteFailed = createAction('[Inspection] Plan Write Failed', props<{ plan: InspectionPlan; reason: string }>())

export const lockBaseline = createAction('[Approval] Lock Baseline')
/** 按原快照查看已锁定批次 */
export const viewSnapshot = createAction('[Approval] View Snapshot', props<{ batchId: string | null }>())
