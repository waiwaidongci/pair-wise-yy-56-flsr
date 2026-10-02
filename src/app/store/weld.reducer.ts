import { createReducer, on } from '@ngrx/store'
import type {
  AuditEvent,
  BatchSnapshot,
  BlockReason,
  InspectionPlan,
  PlanEntry,
  RevisionBatch,
  RevisionDraft,
  Weld,
  WeldMapping,
} from '../types'
import * as A from './weld.actions'

export interface WeldState {
  welds: Weld[]
  plans: InspectionPlan[]
  batches: RevisionBatch[]
  drafts: RevisionDraft[]
  blocks: BlockReason[]
  snapshots: Record<string, BatchSnapshot>
  activeBatchId: string
  viewingBatchId: string
  selectedId: string
  statusFilter: string
  writeErrors: { planId: string; time: string; detail: string; restored: number }[]
  audit: AuditEvent[]
}

const initialAudit: AuditEvent[] = [
  { id: 'AE-1', time: '16:38', actor: '赵岚', action: '提交复检', target: 'W-104', detail: '返修后 UT 复检合格，等待审核签字' },
  { id: 'AE-2', time: '15:12', actor: '陈锋', action: '录入缺陷', target: 'W-107', detail: '翼缘板端部夹渣，长度 12mm，Ⅱ级' },
  { id: 'AE-3', time: '14:20', actor: '系统', action: '资质预警', target: 'W-109', detail: '焊工证书 2026-10-01 到期，不得列入后续检测计划' },
]

export const initialState: WeldState = {
  welds: [], plans: [], batches: [], drafts: [], blocks: [], snapshots: {},
  activeBatchId: '', viewingBatchId: '', selectedId: '', statusFilter: '全部', writeErrors: [], audit: initialAudit,
}

const ZONE_REASONS: Record<string, string> = {
  'Z-3': 'Z-3 北侧对接区暂停：等待支座交接验收',
  'Z-4': 'Z-4 端部支座区暂停：B 版已取消该区域节点 J-A5',
}

const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const ev = (actor: string, action: string, target: string, detail: string): AuditEvent =>
  ({ id: `AE-${Math.random().toString(36).slice(2, 9)}`, time: now(), actor, action, target, detail })

const inScope = (w: Weld, b: RevisionBatch) => b.scopeDrawings.includes(w.drawing)
const unfinished = (p: InspectionPlan) => p.state !== '已完成'

interface EntryVerdict {
  valid: boolean
  flag?: PlanEntry['flag']
  blockCode?: string
  blockReason?: string
}

/** 换版后按当前焊缝/施工区状态重算单条计划明细 */
function entryVerdict(weld: Weld, batch: RevisionBatch): EntryVerdict {
  if (weld.mappingState === '待映射') {
    return { valid: false, flag: '已阻断', blockCode: 'NODE_UNMAPPED', blockReason: `B 版无对应节点，台账暂挂旧节点 ${weld.node}` }
  }
  if (batch.zones[weld.zone] === '暂停') {
    return { valid: false, flag: '需重新排期', blockCode: 'ZONE_PAUSED', blockReason: ZONE_REASONS[weld.zone] ?? `施工区 ${weld.zone} 已暂停` }
  }
  return { valid: true, flag: '已重算' }
}

function recomputePlans(plans: InspectionPlan[], welds: Weld[], batch: RevisionBatch) {
  const planBlocks: BlockReason[] = []
  const next = plans.map((plan) => {
    // 已完工计划不随换版重算；未完工计划逐条明细重算，范围外焊缝原样透传
    if (!unfinished(plan)) return plan
    const entries = plan.entries.map((entry): PlanEntry => {
      const weld = welds.find((w) => w.id === entry.weldId)
      if (!weld) return { ...entry, valid: false, flag: '已阻断', blockCode: 'NODE_UNMAPPED', blockReason: '焊缝台账中不存在', writeState: '待写入' }
      if (!inScope(weld, batch)) return { ...entry, node: weld.node, zone: weld.zone, valid: true, flag: undefined, blockCode: undefined, blockReason: undefined }
      const verdict = entryVerdict(weld, batch)
      if (!verdict.valid) {
        planBlocks.push({
          id: `BLK-P-${plan.id}-${weld.id}`, severity: '阻断', scope: '计划', refId: plan.id,
          code: verdict.blockCode!, batchId: batch.id,
          message: `${plan.id} · ${weld.id}（${weld.node}）：${verdict.blockReason}`,
        })
      }
      return { ...entry, node: weld.node, zone: weld.zone, ...verdict, writeState: '待写入' }
    })
    return { ...plan, batchId: batch.id, recomputedFor: batch.id, entries }
  })
  return { plans: next, planBlocks }
}

function buildWeldBlocks(welds: Weld[], batch: RevisionBatch): BlockReason[] {
  const blocks: BlockReason[] = []
  const isClosed = (w: Weld) => w.status === '合格' || w.status === '已关闭'
  for (const weld of welds) {
    if (weld.batchId !== batch.id) continue
    if (weld.mappingState === '待映射') {
      const closed = isClosed(weld)
      blocks.push({
        id: `BLK-W-${weld.id}-NODE_UNMAPPED`, severity: closed ? '预警' : '阻断', scope: '焊缝', refId: weld.id,
        code: 'NODE_UNMAPPED', batchId: batch.id,
        message: closed
          ? `${weld.id} 为已完工记录：B 版取消节点 ${weld.node}，保留原始数据并待映射归档，不得静默丢失`
          : `${weld.id} 暂挂旧节点 ${weld.node}：B 版无对应节点，需补录映射后方可施工与检测`,
      })
    }
    if (weld.zoneState === '暂停' && !isClosed(weld)) {
      blocks.push({
        id: `BLK-W-${weld.id}-ZONE_PAUSED`, severity: '阻断', scope: '焊缝', refId: weld.id,
        code: 'ZONE_PAUSED', batchId: batch.id,
        message: `${weld.id} 所在${ZONE_REASONS[weld.zone] ?? `施工区 ${weld.zone} 已暂停`}`,
      })
    }
    if (!weld.qualificationValid) {
      blocks.push({
        id: `BLK-W-${weld.id}-WELDER_QUAL`, severity: '预警', scope: '焊缝', refId: weld.id,
        code: 'WELDER_QUAL', batchId: batch.id,
        message: `${weld.id} 焊工 ${weld.welder} 证书今日到期，列入计划前必须更换持证焊工`,
      })
    }
  }
  return blocks
}

/** 应用换版映射：toNode 为 null 时回填待映射标记，绝不静默丢弃焊缝 */
function switchWeld(weld: Weld, row: WeldMapping, batch: RevisionBatch): Weld {
  if (row.toNode) {
    const node = batch.nodes.find((n) => n.name === row.toNode)!
    return {
      ...weld, batchId: batch.id, node: node.name, nodeB: node.name, zone: node.zone,
      zoneState: batch.zones[node.zone] ?? '允许', mappingState: '已映射',
      mappingNote: `A版节点 ${row.fromNode} → B版 ${node.name}（随批次 ${batch.id} 更名）`,
    }
  }
  return {
    ...weld, batchId: batch.id, node: row.fromNode, nodeB: undefined,
    zoneState: batch.zones[weld.zone] ?? weld.zoneState,
    mappingState: '待映射',
    mappingNote: `B 版取消节点 ${row.fromNode}：台账暂挂旧节点号，回填待映射，等待补录（数据保留不丢失）`,
  }
}

export const weldReducer = createReducer(
  initialState,
  on(A.loadWeldsSuccess, (state, { welds, plans, batches, drafts, blocks, snapshots, audit }) => ({
    ...state, welds, plans, batches, drafts, blocks, snapshots, audit,
    activeBatchId: batches.find((b) => b.status !== '已锁定')?.id ?? batches[0]?.id ?? '',
    viewingBatchId: batches[0]?.id ?? '',
    selectedId: state.selectedId || welds[0]?.id || '',
  })),
  on(A.selectWeld, (state, { id }) => ({ ...state, selectedId: id })),
  on(A.filterStatus, (state, { status }) => ({ ...state, statusFilter: status })),

  on(A.advanceWeld, (state, { id, status }) => {
    const batch = state.batches.find((b) => b.id === state.activeBatchId)
    if (batch?.status === '已锁定') return state
    const welds = state.welds.map((w) => (w.id === id ? { ...w, status } : w))
    const blocks = batch ? [...buildWeldBlocks(welds, batch), ...state.blocks.filter((b) => b.scope === '计划')] : state.blocks
    return {
      ...state, welds, blocks,
      audit: [ev('当前审核人', '状态流转', id, `状态变更为 ${status}`), ...state.audit],
    }
  }),

  on(A.createPlan, (state, { plan }) => {
    const batch = state.batches.find((b) => b.id === state.activeBatchId)
    if (batch?.status === '已锁定') return state
    return { ...state, plans: [plan, ...state.plans], audit: [ev('检测班组', '生成计划', plan.id, `按批次 ${plan.batchId} 生成 ${plan.entries.length} 条检测任务`), ...state.audit] }
  }),

  /**
   * 换版确认的并发裁决：同一版本号先提交者生效，后提交者原样保留改动并收到冲突。
   */
  on(A.submitRevision, (state, { draftId, batch: submitted, mapping }) => {
    const draft = state.drafts.find((d) => d.id === draftId)
    if (!draft) return state
    const alreadyEffective = !!state.batches.find((b) => b.id === submitted.id)

    if (alreadyEffective) {
      const winner = state.batches.find((b) => b.id === submitted.id)!
      const own = submitted.nodes.filter((n) => !winner.nodes.some((wn) => wn.name === n.name)).map((n) => n.name)
      const drafts = state.drafts.map((d) => d.id === draftId ? {
        ...d, status: '保留' as const,
        conflict: {
          winnerBatchId: winner.id, winnerBy: winner.confirmedBy ?? '先提交深化员',
          reason: `B 版换版已由 ${winner.confirmedBy} 先行提交生效（先到先得）；后到提交不覆盖换版结果，您的草稿与改动已原样保留。`,
          changes: own.length ? `保留改动：新增节点 ${own.join('、')}；施工区增加 ${submitted.allowedZones.filter((z) => !winner.allowedZones.includes(z)).join('、') || '—'}` : '保留改动：节点与施工区映射意见',
        },
      } : d)
      return { ...state, drafts, audit: [ev(draft.author, '换版冲突', submitted.id, `提交晚于 ${winner.confirmedBy}，改动保留在草稿 ${draftId}，未覆盖已生效批次`), ...state.audit] }
    }

    const batch: RevisionBatch = { ...submitted, status: '已生效', effectiveAt: `${now()} 生效`, confirmedBy: draft.author }
    const welds = state.welds.map((w) => {
      const row = mapping.find((m) => m.weldId === w.id)
      return row && inScope(w, batch) ? switchWeld(w, row, batch) : w
    })
    const recomputed = recomputePlans(state.plans, welds, batch)
    const blocks = [...buildWeldBlocks(welds, batch), ...recomputed.planBlocks]
    const drafts = state.drafts.map((d) => d.id === draftId ? { ...d, status: '已采纳' as const } : d)
    const unmapped = welds.filter((w) => w.batchId === batch.id && w.mappingState === '待映射')

    return {
      ...state, batches: [...state.batches, batch], welds, plans: recomputed.plans, blocks, drafts,
      activeBatchId: batch.id, viewingBatchId: batch.id,
      audit: [
        ev(draft.author, '换版生效', batch.id, `屋盖深化图 A 版 → B 版：固定图纸号 ${batch.drawingNo}、${batch.nodes.length} 个节点命名与 ${batch.allowedZones.length} 个施工区`),
        ev('系统', '计划重算', '未完工检测计划', '未完工计划立即按 B 版重算；已完工计划不重算；' + (unmapped.map((w) => w.id).join('、') || '无') + ' 回填待映射'),
        ...state.audit,
      ],
    }
  }),

  on(A.resolveBlock, (state, { id }) => {
    const block = state.blocks.find((b) => b.id === id)
    const active = state.batches.find((b) => b.id === state.activeBatchId)
    if (!block || !active || active.status === '已锁定') return state

    let welds = state.welds
    let batches = state.batches
    let batch = active
    if (block.scope === '焊缝' && block.refId) {
      if (block.code === 'NODE_UNMAPPED') {
        // 现场补录映射：旧节点并入 B 版 J-B1，台账数据完整保留
        welds = welds.map((w) => w.id === block.refId ? {
          ...w, node: 'J-B1', nodeB: 'J-B1', zone: 'Z-1', zoneState: '允许', mappingState: '已映射',
          mappingNote: `补录映射：A版 ${w.node} → B版 J-B1（跨中拼装区），补单日期 2026-10-02`,
        } : w)
      } else if (block.code === 'ZONE_PAUSED') {
        const zone = welds.find((w) => w.id === block.refId)?.zone
        if (zone) {
          const zones = { ...active.zones, [zone]: '允许' as const }
          batches = batches.map((b) => b.id === active.id ? { ...b, zones } : b)
          batch = { ...active, zones }
          welds = welds.map((w) => w.zone === zone && w.batchId === active.id ? { ...w, zoneState: '允许' } : w)
        }
      }
    }
    const recomputed = recomputePlans(state.plans, welds, batch)
    const blocks = [...buildWeldBlocks(welds, batch), ...recomputed.planBlocks]
    return {
      ...state, batches, welds, plans: recomputed.plans, blocks,
      audit: [ev('现场/质量员', '阻断解除', block.refId ?? block.id, `${block.code} 已处理，相关未完工计划重新核算`), ...state.audit],
    }
  }),

  on(A.planWriteFailed, (state, { planId, detail }) => {
    const plan = state.plans.find((p) => p.id === planId)
    if (!plan || plan.writeState === '写入失败') return state
    const plans = state.plans.map((p) => p.id === planId ? {
      ...p, writeState: '写入失败' as const,
      entries: p.entries.map((e) => e.writeState === '待写入' ? { ...e, writeState: '写入失败' as const } : e),
    } : p)
    return {
      ...state, plans, writeErrors: [...state.writeErrors, { planId, time: now(), detail, restored: 0 }],
      audit: [ev('系统', '计划写入失败', planId, `${detail}；已确认条目保留为恢复基线，未做静默回滚`)],
    }
  }),

  on(A.recoverPlanFromConfirmed, (state, { planId }) => {
    const plans = state.plans.map((p) => p.id === planId ? {
      ...p, writeState: '正常' as const,
      entries: p.confirmedEntries.map((e) => ({ ...e, writeState: '已恢复' as const })),
    } : p)
    const restored = state.plans.find((p) => p.id === planId)?.confirmedEntries.length ?? 0
    const writeErrors = state.writeErrors.map((e) => e.planId === planId && e.restored === 0 ? { ...e, restored } : e)
    return {
      ...state, plans, writeErrors,
      audit: [ev('系统', '计划恢复', planId, `从已确认条目恢复 ${restored} 条，标记为“已恢复”，需重新确认换版差异`), ...state.audit],
    }
  }),

  on(A.lockBaseline, (state) => {
    const id = state.activeBatchId
    const batch = state.batches.find((b) => b.id === id)
    if (!batch || id !== state.activeBatchId || batch.status === '已锁定') return state
    if (state.blocks.some((b) => b.severity === '阻断')) return state
    if (state.plans.some((p) => p.writeState === '写入失败')) return state

    const lockedBatch: RevisionBatch = { ...batch, status: '已锁定' }
    const plans = state.plans.map((p) => p.batchId !== id ? p : {
      ...p,
      entries: p.entries.map((e) => ({ ...e, writeState: '已确认' as const })),
      confirmedEntries: p.entries.map((e) => ({ ...e, writeState: '已确认' as const })),
    })
    const snapshot: BatchSnapshot = {
      batchId: id, lockedAt: `${now()} 锁定`, lockedBy: '质量负责人 高岳',
      batch: lockedBatch, welds: structuredClone(state.welds), plans: structuredClone(plans), blocks: structuredClone(state.blocks),
    }
    return {
      ...state,
      batches: state.batches.map((b) => b.id === id ? lockedBatch : b), plans,
      snapshots: { ...state.snapshots, [id]: snapshot },
      audit: [ev('质量负责人 高岳', '签字锁定', id, `批次 ${lockedBatch.label} 已锁定：图纸号、节点命名、焊缝映射与检测计划按快照只读保存`), ...state.audit],
    }
  }),

  on(A.viewBatch, (state, { batchId }) => ({ ...state, viewingBatchId: batchId })),
)
