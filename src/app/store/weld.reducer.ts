import { createReducer, on } from '@ngrx/store'
import type { AuditEvent, DrawingRevision, InspectionPlan, LockedSnapshot, RevisionConflict, Weld } from '../types'
import * as A from './weld.actions'

export interface WeldState {
  welds: Weld[]
  plans: InspectionPlan[]
  /** 已确认计划条目：写入失败后从此处恢复 */
  confirmedPlans: InspectionPlan[]
  selectedId: string
  statusFilter: string
  locked: boolean
  version: number
  audit: AuditEvent[]
  /** 当前换版批次 */
  revision: DrawingRevision
  /** 并发提交冲突（先到的换版结果已生效） */
  conflict: RevisionConflict | null
  /** 已保留的异议改动 */
  keptObjections: RevisionConflict[]
  /** 已签字锁定的批次快照 */
  snapshots: LockedSnapshot[]
  /** 当前查看的已锁定批次（null 表示看当前工作批次） */
  viewingBatchId: string | null
  writeState: 'idle' | 'writing' | 'recovered'
  lastWriteError: string | null
}

const audit: AuditEvent[] = [
  { id: 'AE-1', time: '16:38', actor: '赵岚', action: '提交复检', target: 'W-104', detail: '返修后 UT 复检合格，等待审核签字' },
  { id: 'AE-2', time: '15:12', actor: '陈锋', action: '录入缺陷', target: 'W-107', detail: '翼缘板端部夹渣，长度 12mm，Ⅱ级' },
  { id: 'AE-3', time: '14:20', actor: '系统', action: '资质预警', target: 'W-109', detail: '焊工证书 2026-10-01 到期，不得列入后续检测计划' },
]

/** A 版初始批次：图纸号、节点命名、允许施工区在发版时固定 */
const initialRevision: DrawingRevision = {
  batchId: 'REV-2026-0930-A',
  drawingNo: 'SG-07',
  version: 'A',
  nodeNaming: 'A版节点命名：柱 KZ-* / 梁 GL-* / 平台 PL-*',
  allowedZones: ['①-④轴', '②-⑥轴'],
  releasedAt: '2026-09-20 10:00',
  releasedBy: '设计院',
  revision: 1,
  status: '已发布',
}

const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * B 版节点命名重映射：
 * B 版深化图仅发布屋面区域，屋面梁 GL-* 沿用 A 版编号；
 * 柱 KZ-*、平台 PL-* 在 B 版节点命名中没有新节点 —— 返回 null，
 * 由调用方回填「待映射」标记，旧节点号保留，不静默丢失。
 */
function remapNodeB(weld: Weld): string | null {
  if (weld.node.startsWith('GL-')) return weld.node
  return null
}

/** 图纸版本一变，未完工计划立即重算：解析焊缝节点，含待映射/缺失节点的计划阻断 */
function recalcPlans(plans: InspectionPlan[], welds: Weld[], batchId: string): InspectionPlan[] {
  return plans.map((plan) => {
    if (plan.state === '已完成') return { ...plan, batchId }
    const unresolved = plan.weldIds.filter((id) => {
      const weld = welds.find((w) => w.id === id)
      return !weld || weld.mappingStatus === '待映射'
    })
    if (unresolved.length) {
      return { ...plan, batchId, blocked: true, blockReason: `未完工计划随换版重算：${unresolved.join('、')} 无 B 版新节点（待映射），计划暂停执行` }
    }
    return { ...plan, batchId, blocked: false, blockReason: null }
  })
}

export const initialState: WeldState = {
  welds: [],
  plans: [],
  confirmedPlans: [],
  selectedId: '',
  statusFilter: '全部',
  locked: false,
  version: 12,
  audit,
  revision: initialRevision,
  conflict: null,
  keptObjections: [],
  snapshots: [],
  viewingBatchId: null,
  writeState: 'idle',
  lastWriteError: null,
}

export const weldReducer = createReducer(
  initialState,

  on(A.loadWeldsSuccess, (state, { welds, plans }) => {
    const normalizedPlans = plans.map((plan) => ({
      ...plan,
      batchId: plan.batchId ?? state.revision.batchId,
      blocked: plan.blocked ?? false,
      blockReason: plan.blockReason ?? null,
    }))
    return {
      ...state,
      welds: welds.map((weld) => ({ ...weld, node: weld.node ?? '', mappingStatus: weld.mappingStatus ?? '已映射' })),
      plans: normalizedPlans,
      confirmedPlans: normalizedPlans,
      selectedId: state.selectedId || welds[0]?.id || '',
    }
  }),

  on(A.selectWeld, (state, { id }) => ({ ...state, selectedId: id })),
  on(A.filterStatus, (state, { status }) => ({ ...state, statusFilter: status })),

  on(A.advanceWeld, (state, { id, status }) => ({
    ...state,
    version: state.version + 1,
    welds: state.welds.map((weld) => weld.id === id ? { ...weld, status } : weld),
    audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '当前审核人', action: '状态流转', target: id, detail: `状态变更为 ${status}` }, ...state.audit],
  })),

  on(A.createPlan, (state, { plan }) => ({ ...state, plans: [plan, ...state.plans], version: state.version + 1 })),

  // 深化员提交 B 版确认：比对批次修订号，先到先得
  on(A.releaseRevision, (state, { proposal, baseRevision, submittedBy }) => {
    if (baseRevision !== state.revision.revision) {
      const conflict: RevisionConflict = {
        batchId: proposal.batchId,
        submittedBy,
        basedOnRevision: baseRevision,
        currentRevision: state.revision.revision,
        reason: `您的提交基于旧修订 rev.${baseRevision}，换版批次已被先到的提交更新为 rev.${state.revision.revision}；先到的换版结果生效，您的改动已保留。`,
        theirNodeNaming: proposal.nodeNaming,
        theirAllowedZones: proposal.allowedZones,
        kept: false,
      }
      return {
        ...state,
        conflict,
        audit: [{ id: `AE-${Date.now()}`, time: now(), actor: submittedBy, action: '换版冲突', target: proposal.batchId, detail: `B 版确认基于 rev.${baseRevision} 已过期，批次当前 rev.${state.revision.revision}，先到结果生效` }, ...state.audit],
      }
    }

    const newRevision: DrawingRevision = { ...proposal, revision: state.revision.revision + 1, status: '已发布' }
    // 焊缝按 B 版节点命名重映射：无新节点的回填「待映射」，旧节点号保留不丢失
    const welds = state.welds.map((weld) => {
      const mapped = remapNodeB(weld)
      return mapped ? { ...weld, node: mapped, mappingStatus: '已映射' as const } : { ...weld, mappingStatus: '待映射' as const }
    })
    const pendingCount = welds.filter((w) => w.mappingStatus === '待映射').length
    // 图纸版本一变，未完工计划立即重算
    const plans = recalcPlans(state.plans, welds, newRevision.batchId)
    const blockedCount = plans.filter((p) => p.blocked && p.state !== '已完成').length
    return {
      ...state,
      revision: newRevision,
      welds,
      plans,
      locked: false,
      viewingBatchId: null,
      version: state.version + 1,
      conflict: null,
      audit: [
        { id: `AE-${Date.now()}`, time: now(), actor: submittedBy, action: '发布换版批次', target: newRevision.batchId, detail: `图版 ${newRevision.version} · 图纸号 ${newRevision.drawingNo} 已固定；${pendingCount} 条焊缝无新节点回填待映射，${blockedCount} 个未完工计划重算阻断` },
        ...state.audit,
      ],
    }
  }),

  on(A.releaseRevisionConflict, (state, { conflict }) => ({ ...state, conflict })),

  on(A.clearConflict, (state, { kept }) => ({
    ...state,
    conflict: null,
    keptObjections: kept && state.conflict ? [{ ...state.conflict, kept: true }, ...state.keptObjections] : state.keptObjections,
    audit: kept && state.conflict
      ? [{ id: `AE-${Date.now()}`, time: now(), actor: state.conflict.submittedBy, action: '保留异议', target: state.conflict.batchId, detail: `已保留对 rev.${state.conflict.currentRevision} 换版结果的异议改动` }, ...state.audit]
      : state.audit,
  })),

  // 计划写入：乐观写入，随后由服务端校验确认或拒绝
  on(A.planWriteRequested, (state, { plan }) => ({
    ...state,
    plans: [plan, ...state.plans],
    writeState: 'writing' as const,
    lastWriteError: null,
    version: state.version + 1,
  })),
  on(A.planWriteConfirmed, (state, { plan }) => ({
    ...state,
    confirmedPlans: state.plans,
    writeState: 'idle' as const,
    audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '系统', action: '计划写入确认', target: plan.id, detail: `检测计划已写入并加入已确认条目（${plan.weldIds.length} 条焊缝）` }, ...state.audit],
  })),
  on(A.planWriteFailed, (state, { reason }) => ({
    ...state,
    plans: state.confirmedPlans,
    writeState: 'recovered' as const,
    lastWriteError: reason,
    audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '系统', action: '写入失败恢复', target: '检测计划', detail: `服务端拒绝写入：${reason}；已从 ${state.confirmedPlans.length} 条已确认条目恢复` }, ...state.audit],
  })),

  on(A.lockBaseline, (state) => {
    const snapshot: LockedSnapshot = {
      batchId: state.revision.batchId,
      drawingNo: state.revision.drawingNo,
      version: state.revision.version,
      revision: state.revision.revision,
      nodeNaming: state.revision.nodeNaming,
      allowedZones: state.revision.allowedZones,
      lockedAt: now(),
      lockedBy: '质量负责人',
      welds: state.welds.map((w) => ({ ...w })),
      plans: state.plans.map((p) => ({ ...p })),
    }
    return {
      ...state,
      locked: true,
      revision: { ...state.revision, status: '已锁定' as const },
      snapshots: [snapshot, ...state.snapshots],
      viewingBatchId: null,
      audit: [{ id: `AE-${Date.now()}`, time: now(), actor: '质量负责人', action: '签字锁定', target: state.revision.batchId, detail: `批次 ${state.revision.batchId}（rev.${state.revision.revision}）已签字，按原图纸号、节点命名与焊缝计划生成只读快照` }, ...state.audit],
    }
  }),

  on(A.viewSnapshot, (state, { batchId }) => ({ ...state, viewingBatchId: batchId })),
)
