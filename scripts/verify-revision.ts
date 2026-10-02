import '@angular/compiler'
import { buildSeed } from '../src/app/seed'
import { initialState, weldReducer } from '../src/app/store/weld.reducer'
import * as A from '../src/app/store/weld.actions'
import { selectBatchView, canLock } from '../src/app/store/weld.selectors'

let failures = 0
const assert = (cond: boolean, msg: string) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg)
  if (!cond) failures++
}

const seed = buildSeed()
let s = weldReducer(initialState, A.loadWeldsSuccess(seed))

// 1. 初始：只有 A 版锁定批次，快照存在
assert(s.activeBatchId === 'RB-A', '初始工作批次为锁定的 A 版 RB-A')
assert(!!s.snapshots['RB-A'], 'A 版存在签字锁定快照')

// 2. 陈锋先提交 B 版 → 生效
s = weldReducer(s, A.submitRevision({ draftId: 'DRAFT-CHEN', batch: seed.drafts[0].batch, mapping: seed.drafts[0].mapping }))
assert(s.activeBatchId === 'RB-B', '先提交者：RB-B 成为当前换版批次')
const chen = s.drafts.find((d) => d.id === 'DRAFT-CHEN')!
assert(chen.status === '已采纳', '陈锋草稿标记为已采纳')

const w109 = s.welds.find((w) => w.id === 'W-109')!
assert(w109.mappingState === '待映射' && w109.node === 'J-A5', 'W-109 无新节点：暂挂旧节点 J-A5 并回填待映射（不丢失）')
assert(w109.batchId === 'RB-B' && w109.mappingNote.includes('待映射'), 'W-109 待映射说明已回填')
const w104 = s.welds.find((w) => w.id === 'W-104')!
assert(w104.node === 'J-B1' && w104.nodeB === 'J-B1', 'W-104 节点随批更名 J-A1 → J-B1')
const w107 = s.welds.find((w) => w.id === 'W-107')!
assert(w107.node === 'J-B2' && w107.zoneState === '暂停', 'W-107 进入暂停区 Z-3')

// 3. 未完工计划立即重算，已完工不重算
const pA = s.plans.find((p) => p.id === 'IP-2026-0930-A')!
assert(pA.recomputedFor === 'RB-B', '待执行计划 IP-...-A 标记为按 RB-B 重算')
const e109 = pA.entries.find((e) => e.weldId === 'W-109')!
assert(!e109.valid && e109.flag === '已阻断' && e109.blockCode === 'NODE_UNMAPPED', 'W-109 计划明细阻断：NODE_UNMAPPED')
const e104 = pA.entries.find((e) => e.weldId === 'W-104')!
assert(e104.valid && e104.flag === '已重算' && e104.node === 'J-B1', 'W-104 明细有效并已重算到新节点')
const pC = s.plans.find((p) => p.id === 'IP-2026-0920-C')!
assert(!pC.recomputedFor && pC.state === '已完成', '已完工计划 IP-...-C 不重算')
const pB = s.plans.find((p) => p.id === 'IP-2026-0929-B')!
const e107 = pB.entries.find((e) => e.weldId === 'W-107')!
assert(!e107.valid && e107.flag === '需重新排期' && e107.blockCode === 'ZONE_PAUSED', '暂停区明细需重新排期')

// 4. 阻断原因生成，锁定被阻止
assert(s.blocks.some((b) => b.code === 'NODE_UNMAPPED' && b.severity === '阻断'), '存在待映射阻断')
assert(s.blocks.some((b) => b.code === 'ZONE_PAUSED' && b.severity === '阻断'), '存在暂停区阻断')
assert(s.blocks.some((b) => b.code === 'WELDER_QUAL' && b.severity === '预警'), '焊工资质为预警而非阻断')
assert(!canLock(s), '存在阻断时不能签字锁定')
const lockedBefore = weldReducer(s, A.lockBaseline())
assert(lockedBefore === s, '有阻断时分发锁定不改变状态')

// 5. 赵岚后提交 → 冲突，改动保留
s = weldReducer(s, A.submitRevision({ draftId: 'DRAFT-ZHAO', batch: seed.drafts[1].batch, mapping: seed.drafts[1].mapping }))
const zhao = s.drafts.find((d) => d.id === 'DRAFT-ZHAO')!
assert(zhao.status === '保留' && !!zhao.conflict, '后提交者：冲突，草稿保留')
assert(zhao.conflict!.winnerBatchId === 'RB-B' && zhao.conflict!.winnerBy === '深化员 陈锋', '冲突指明先到生效者')
assert(zhao.batch.nodes.some((n) => n.name === 'J-BX'), '后提交者的个人改动 J-BX 原样保留')
assert(!s.batches.some((b) => b.nodes.some((n) => n.name === 'J-BX')), '个人改动未污染已生效批次')
assert(s.activeBatchId === 'RB-B', '冲突提交不改变当前批次')

// 6. 计划写入失败 → 从已确认条目恢复
s = weldReducer(s, A.planWriteFailed({ planId: 'IP-2026-0930-A', detail: '504 timeout' }))
assert(s.plans.find((p) => p.id === 'IP-2026-0930-A')!.writeState === '写入失败', '计划标记写入失败')
assert(!canLock(s), '写入失败时不能锁定')
s = weldReducer(s, A.recoverPlanFromConfirmed({ planId: 'IP-2026-0930-A' }))
const pArecovered = s.plans.find((p) => p.id === 'IP-2026-0930-A')!
assert(pArecovered.writeState === '正常', '恢复后计划写状态正常')
assert(pArecovered.entries.every((e) => e.writeState === '已恢复') && pArecovered.entries.length === 3, '3 条明细全部从确认基线恢复并标记已恢复')
assert(pArecovered.confirmedEntries.length === 3, '确认基线仍保留')

// 7. 现场处理阻断：先解 ZONE_PAUSED（通过 W-107 的焊缝阻断）
const zoneBlock = s.blocks.find((b) => b.refId === 'W-107' && b.code === 'ZONE_PAUSED')!
s = weldReducer(s, A.resolveBlock({ id: zoneBlock.id }))
assert(!s.blocks.some((b) => b.refId === 'W-107' && b.code === 'ZONE_PAUSED'), 'W-107 的暂停区阻断解除（Z-4 的 W-109 仍合法阻断）')
assert(s.blocks.some((b) => b.refId === 'W-109' && b.code === 'ZONE_PAUSED'), 'Z-4 未放行，W-109 暂停区阻断仍在')
const w107b = s.welds.find((w) => w.id === 'W-107')!
assert(w107b.zoneState === '允许', 'W-107 施工区变为允许')
const e107b = s.plans.find((p) => p.id === 'IP-2026-0929-B')!.entries.find((e) => e.weldId === 'W-107')!
assert(e107b.valid && e107b.flag === '已重算', '计划随阻断解除重新核算为有效')

// 8. 补录 W-109 映射
const mapBlock = s.blocks.find((b) => b.refId === 'W-109' && b.code === 'NODE_UNMAPPED' && b.severity === '阻断')!
s = weldReducer(s, A.resolveBlock({ id: mapBlock.id }))
const w109b = s.welds.find((w) => w.id === 'W-109')!
assert(w109b.mappingState === '已映射' && w109b.node === 'J-B1', 'W-109 补录映射后并入 J-B1，数据仍在台账')
assert(!s.blocks.some((b) => b.severity === '阻断'), '全部阻断清零（资质仅为预警）')
assert(canLock(s), '阻断清零且无写入失败，可以签字锁定')

// 9. 签字锁定 B 版 → 生成快照
s = weldReducer(s, A.lockBaseline())
const bBatch = s.batches.find((b) => b.id === 'RB-B')!
assert(bBatch.status === '已锁定', 'RB-B 签字锁定')
assert(!!s.snapshots['RB-B'], 'RB-B 生成只读快照')

// 10. 锁定后修改被拒绝，视图按快照
s = weldReducer(s, A.advanceWeld({ id: 'W-104', status: '合格' }))
const still = s.welds.find((w) => w.id === 'W-104')!
assert(still.status === '待复检', '锁定批次不可修改焊缝状态')

// 查看 B 快照：随后造一个“C 版”状态，快照视图不变
let s2 = weldReducer(s, A.viewBatch({ batchId: 'RB-A' }))
const viewA = selectBatchView(s2)
assert(viewA.snapshot !== null && viewA.batch.id === 'RB-A', '切到 A 版读原快照')
assert(viewA.welds.every((w) => w.nodeA === w.node || w.batchId === 'RB-A'), 'A 快照仍是旧节点命名（J-A*）')
assert(viewA.plans.every((p) => !p.recomputedFor), 'A 快照中的计划没有 B 版重算痕迹')
const viewB = selectBatchView({ ...s, viewingBatchId: 'RB-B' })
assert(viewB.snapshot !== null && viewB.welds.some((w) => w.nodeB === 'J-B1'), 'B 快照保留 B 版节点命名')

// 11. 四页同源：同批修订与阻断在视图中一致
assert(viewB.batch.revisionItems.length >= 5, 'B 批次含同批修订条目（图号/节点/施工区/映射/计划）')
assert(viewB.snapshot!.blocks.length === 0 || !viewB.snapshot!.blocks.some((b) => b.severity === '阻断'), 'B 快照锁定时点无阻断')

console.log(failures ? `\n${failures} FAILURES` : '\nALL TESTS PASSED')
process.exit(failures ? 1 : 0)
