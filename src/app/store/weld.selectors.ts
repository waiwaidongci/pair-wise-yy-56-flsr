import type { BatchSnapshot, BlockReason, InspectionPlan, RevisionBatch, RevisionDraft, Weld } from '../types'
import type { WeldState } from './weld.reducer'

export interface BatchView {
  batch: RevisionBatch
  welds: Weld[]
  plans: InspectionPlan[]
  blocks: BlockReason[]
  /** 快照视图（已锁定批次）只读 */
  snapshot: BatchSnapshot | null
  /** 当前工作批次（可处理阻断、签字锁定） */
  isActive: boolean
  activeBatch: RevisionBatch
  drafts: RevisionDraft[]
}

const EMPTY_BATCH: RevisionBatch = {
  id: '', label: '加载中…', drawingNo: '—', scopeDrawings: [], status: '待确认',
  publishedAt: '—', nodes: [], allowedZones: [], zones: {}, revisionItems: [],
}

export function selectBatchView(state: WeldState | undefined): BatchView {
  if (!state || !state.batches.length) {
    return { batch: EMPTY_BATCH, welds: [], plans: [], blocks: [], snapshot: null, isActive: false, activeBatch: EMPTY_BATCH, drafts: [] }
  }
  const activeBatch = state.batches.find((b) => b.id === state.activeBatchId) ?? state.batches[state.batches.length - 1]
  const viewing = state.batches.find((b) => b.id === state.viewingBatchId) ?? activeBatch
  const snapshot = viewing?.status === '已锁定' ? state.snapshots[viewing.id] ?? null : null
  if (snapshot) {
    return { batch: snapshot.batch, welds: snapshot.welds, plans: snapshot.plans, blocks: snapshot.blocks, snapshot, isActive: false, activeBatch, drafts: state.drafts }
  }
  return { batch: viewing, welds: state.welds, plans: state.plans, blocks: state.blocks, snapshot: null, isActive: viewing.id === activeBatch.id, activeBatch, drafts: state.drafts }
}

/** 四个页面共用：当前批次的同批修订 + 阻断原因 */
export function batchRevisions(view: BatchView) {
  return view.batch.revisionItems.map((item) => ({
    item,
    blocks: view.blocks.filter((b) => item.relatedBlockCodes.includes(b.code)),
  }))
}

export function weldsByBlockCode(view: BatchView, code: string) {
  return new Set(view.blocks.filter((b) => b.scope === '焊缝' && b.code === code).map((b) => b.refId))
}

export function canLock(state: WeldState): boolean {
  const batch = state.batches.find((b) => b.id === state.activeBatchId)
  if (!batch || batch.status === '已锁定') return false
  if (state.blocks.some((b) => b.severity === '阻断')) return false
  if (state.plans.some((p) => p.writeState === '写入失败')) return false
  return true
}

export function lockBlockers(state: WeldState): string[] {
  const blockers: string[] = []
  for (const b of state.blocks.filter((x) => x.severity === '阻断')) blockers.push(b.message)
  for (const p of state.plans.filter((x) => x.writeState === '写入失败')) blockers.push(`${p.id} 写入失败，须先从已确认条目恢复`)
  return blockers
}
