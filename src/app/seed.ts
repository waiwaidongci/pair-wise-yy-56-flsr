import type {
  AuditEvent, BatchSnapshot, BlockReason, InspectionPlan, PlanEntry, RevisionBatch, RevisionDraft, Weld,
} from './types'

const weldSeed = (): Weld[] => [
  { id: 'W-101', drawing: 'SG-04-钢柱', component: 'KZ-12 / 柱翼缘', joint: '全熔透坡口焊', node: 'J-A1', nodeA: 'J-A1', zone: 'Z-2', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'GMAW', welder: '王凯', qualification: 'GB/T 9448 · 2027-06', qualificationValid: true, inspectionRatio: 100, requiredRatio: 100, status: '合格', x: 18, y: 24, repairs: 0, defects: [] },
  { id: 'W-102', drawing: 'SG-07-屋面梁', component: 'GL-21 / 上翼缘', joint: '对接焊缝', node: 'J-A1', nodeA: 'J-A1', zone: 'Z-3', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'GMAW', welder: '李铮', qualification: 'GB/T 9448 · 2027-09', qualificationValid: true, inspectionRatio: 100, requiredRatio: 100, status: '待检测', x: 30, y: 30, repairs: 0, defects: [] },
  { id: 'W-103', drawing: 'SG-07-屋面梁', component: 'GL-21 / 上翼缘', joint: '对接焊缝', node: 'J-A1', nodeA: 'J-A1', zone: 'Z-3', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'GMAW', welder: '李铮', qualification: 'GB/T 9448 · 2027-09', qualificationValid: true, inspectionRatio: 100, requiredRatio: 100, status: '已关闭', x: 40, y: 33, repairs: 0, defects: [] },
  { id: 'W-104', drawing: 'SG-07-屋面梁', component: 'GL-21 / 下翼缘', joint: '对接焊缝', node: 'J-A1', nodeA: 'J-A1', zone: 'Z-1', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'SAW', welder: '刘强', qualification: 'GB/T 9448 · 2028-03', qualificationValid: true, inspectionRatio: 100, requiredRatio: 100, status: '待复检', x: 48, y: 38, repairs: 2, defects: [{ id: 'D-31', position: 42, type: '夹渣', length: 12, level: 'Ⅱ级', method: 'UT', report: 'UT-2026-0918' }] },
  { id: 'W-105', drawing: 'SG-07-屋面梁', component: 'GL-22 / 腹板', joint: '角焊缝', node: 'J-A2', nodeA: 'J-A2', zone: 'Z-3', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'FCAW', welder: '赵明', qualification: 'GB/T 9448 · 2027-01', qualificationValid: true, inspectionRatio: 20, requiredRatio: 20, status: '合格', x: 55, y: 40, repairs: 0, defects: [] },
  { id: 'W-106', drawing: 'SG-07a-檩条详图', component: 'LT-09 / 檩托', joint: '角焊缝', node: 'J-A3', nodeA: 'J-A3', zone: 'Z-1', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'GMAW', welder: '周婷', qualification: 'GB/T 9448 · 2028-05', qualificationValid: true, inspectionRatio: 20, requiredRatio: 20, status: '合格', x: 70, y: 28, repairs: 0, defects: [] },
  { id: 'W-107', drawing: 'SG-07-屋面梁', component: 'GL-21 / 腹板', joint: '角焊缝', node: 'J-A2', nodeA: 'J-A2', zone: 'Z-3', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'FCAW', welder: '赵明', qualification: 'GB/T 9448 · 2027-01', qualificationValid: true, inspectionRatio: 20, requiredRatio: 20, status: '返修中', x: 61, y: 42, repairs: 1, defects: [{ id: 'D-32', position: 68, type: '未熔合', length: 18, level: 'Ⅲ级', method: 'MT', report: 'MT-2026-0921' }] },
  { id: 'W-108', drawing: 'SG-07a-檩条详图', component: 'LT-11 / 檩托', joint: '组合焊缝', node: 'J-A4', nodeA: 'J-A4', zone: 'Z-2', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'GMAW', welder: '王凯', qualification: 'GB/T 9448 · 2027-06', qualificationValid: true, inspectionRatio: 50, requiredRatio: 50, status: '待检测', x: 74, y: 52, repairs: 0, defects: [] },
  { id: 'W-109', drawing: 'SG-07-屋面梁', component: 'GL-23 / 节点板', joint: '角焊缝', node: 'J-A5', nodeA: 'J-A5', zone: 'Z-4', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册', method: 'SMAW', welder: '孙鹏', qualification: 'GB/T 9448 · 2026-10-01', qualificationValid: false, inspectionRatio: 10, requiredRatio: 20, status: '待检测', x: 78, y: 60, repairs: 0, defects: [] },
  { id: 'W-112', drawing: 'SG-12-平台梁', component: 'PL-08 / 腹板', joint: '组合焊缝', node: 'J-A3', nodeA: 'J-A3', zone: 'Z-2', zoneState: '允许', batchId: 'RB-A', mappingState: '已映射', mappingNote: 'A 版在册（不在屋盖换版范围）', method: 'GMAW', welder: '王凯', qualification: 'GB/T 9448 · 2027-06', qualificationValid: true, inspectionRatio: 50, requiredRatio: 50, status: '已关闭', x: 36, y: 68, repairs: 0, defects: [] },
]

const entry = (welds: Weld[], id: string): PlanEntry => {
  const w = welds.find((x) => x.id === id)!
  return { weldId: id, node: w.node, zone: w.zone, valid: true, writeState: '已确认' }
}

const planSeed = (welds: Weld[]): InspectionPlan[] => [
  { id: 'IP-2026-0930-A', date: '2026-09-30', method: 'UT + MT', inspector: '陈锋', state: '待执行', batchId: 'RB-A', writeState: '正常',
    entries: [entry(welds, 'W-101'), entry(welds, 'W-104'), entry(welds, 'W-109')],
    confirmedEntries: [entry(welds, 'W-101'), entry(welds, 'W-104'), entry(welds, 'W-109')] },
  { id: 'IP-2026-0929-B', date: '2026-09-29', method: 'UT', inspector: '赵岚', state: '执行中', batchId: 'RB-A', writeState: '正常',
    entries: [entry(welds, 'W-102'), entry(welds, 'W-107')],
    confirmedEntries: [entry(welds, 'W-102'), entry(welds, 'W-107')] },
  { id: 'IP-2026-0920-C', date: '2026-09-20', method: 'MT', inspector: '赵岚', state: '已完成', batchId: 'RB-A', writeState: '正常',
    entries: [entry(welds, 'W-103'), entry(welds, 'W-106')],
    confirmedEntries: [entry(welds, 'W-103'), entry(welds, 'W-106')] },
]

const batchA = (): RevisionBatch => ({
  id: 'RB-A', label: '屋盖深化 A 版（2026-08 版）', drawingNo: 'SG-07',
  scopeDrawings: ['SG-07-屋面梁', 'SG-07a-檩条详图'], status: '已锁定',
  publishedAt: '2026-08-12 09:00 发版', effectiveAt: '2026-08-15 生效', confirmedBy: '深化负责人 林峥',
  nodes: [
    { name: 'J-A1', zone: 'Z-1', state: '允许' }, { name: 'J-A2', zone: 'Z-3', state: '允许' },
    { name: 'J-A3', zone: 'Z-1', state: '允许' }, { name: 'J-A4', zone: 'Z-2', state: '允许' },
    { name: 'J-A5', zone: 'Z-4', state: '允许' },
  ],
  allowedZones: ['Z-1', 'Z-2', 'Z-3', 'Z-4'],
  zones: { 'Z-1': '允许', 'Z-2': '允许', 'Z-3': '允许', 'Z-4': '允许' },
  revisionItems: [
    { id: 'A-R1', type: '图纸号', title: '发版固定图纸号 SG-07', detail: '屋盖施工图以 SG-07 为固定图纸号建账，后续升版只变版次、不改图号。', impactWeldIds: [], impactPlanIds: [], relatedBlockCodes: [] },
    { id: 'A-R2', type: '允许施工区', title: '固定允许施工区 Z-1 ~ Z-4', detail: 'A 版施工区全部放行，焊缝台账与检测任务按 J-A1 ~ J-A5 节点排程。', impactWeldIds: [], impactPlanIds: [], relatedBlockCodes: [] },
  ],
})

const bRevisionItems = () => [
  { id: 'B-R1', type: '图纸号' as const, title: '图纸号升版 A → B，图号仍固定 SG-07', detail: '发版固定图纸号：现场台账图纸号不随版次改写，旧台账与 A 版检测记录继续可追溯。', impactWeldIds: [], impactPlanIds: ['IP-2026-0930-A', 'IP-2026-0929-B'], relatedBlockCodes: [] as string[] },
  { id: 'B-R2', type: '节点命名' as const, title: '节点命名随 B 版冻结，J-A1 ~ J-A4 更名，J-A5 取消', detail: 'J-A1 按区拆分为 J-B1/J-B2，J-A2→J-B2，J-A3→J-B3，J-A4→J-B4；J-A5 在 B 版取消，无新节点承接。', impactWeldIds: ['W-102', 'W-104', 'W-109'], impactPlanIds: ['IP-2026-0930-A', 'IP-2026-0929-B'], relatedBlockCodes: ['NODE_UNMAPPED'] },
  { id: 'B-R3', type: '允许施工区' as const, title: '允许施工区按 B 版重划', detail: 'Z-3 北侧对接区暂停（等待支座交接验收），Z-4 端部支座区随 J-A5 取消；Z-1/Z-2 继续允许施工。', impactWeldIds: ['W-102', 'W-107'], impactPlanIds: ['IP-2026-0929-B'], relatedBlockCodes: ['ZONE_PAUSED'] },
  { id: 'B-R4', type: '焊缝映射' as const, title: '已有焊缝回填映射，无新节点者标“待映射”', detail: '换版不丢弃台账：B 版无对应节点的焊缝暂挂旧节点号并回填待映射标记，阻断继续施工与检测，补录映射后解除。', impactWeldIds: ['W-109'], impactPlanIds: ['IP-2026-0930-A'], relatedBlockCodes: ['NODE_UNMAPPED'] },
  { id: 'B-R5', type: '检测计划' as const, title: '未完工检测计划立即重算', detail: '图纸版本一变，待执行/执行中计划按新节点命名与施工区立即重算，已完工计划不重算；检测班组排程同步换版。', impactWeldIds: [], impactPlanIds: ['IP-2026-0930-A', 'IP-2026-0929-B', 'IP-2026-0920-C'], relatedBlockCodes: ['ZONE_PAUSED', 'NODE_UNMAPPED', 'WELDER_QUAL'] },
]

const bMapping = () => [
  { weldId: 'W-102', fromNode: 'J-A1', toNode: 'J-B2' },
  { weldId: 'W-103', fromNode: 'J-A1', toNode: 'J-B2' },
  { weldId: 'W-104', fromNode: 'J-A1', toNode: 'J-B1' },
  { weldId: 'W-105', fromNode: 'J-A2', toNode: 'J-B2' },
  { weldId: 'W-106', fromNode: 'J-A3', toNode: 'J-B3' },
  { weldId: 'W-107', fromNode: 'J-A2', toNode: 'J-B2' },
  { weldId: 'W-108', fromNode: 'J-A4', toNode: 'J-B4' },
  { weldId: 'W-109', fromNode: 'J-A5', toNode: null },
]

const bNodes = () => [
  { name: 'J-B1', zone: 'Z-1', state: '允许' as const, renamedFrom: 'J-A1' },
  { name: 'J-B2', zone: 'Z-3', state: '暂停' as const, renamedFrom: 'J-A1/J-A2' },
  { name: 'J-B3', zone: 'Z-1', state: '允许' as const, renamedFrom: 'J-A3' },
  { name: 'J-B4', zone: 'Z-2', state: '允许' as const, renamedFrom: 'J-A4' },
]

const draftBatchB = (): RevisionBatch => ({
  id: 'RB-B', fromBatchId: 'RB-A', label: '屋盖深化 B 版（2026-10 换版）', drawingNo: 'SG-07',
  scopeDrawings: ['SG-07-屋面梁', 'SG-07a-檩条详图'], status: '待确认',
  publishedAt: '2026-10-01 08:30 发版',
  nodes: bNodes(),
  allowedZones: ['Z-1', 'Z-2', 'Z-3'],
  zones: { 'Z-1': '允许', 'Z-2': '允许', 'Z-3': '暂停', 'Z-4': '暂停' },
  revisionItems: bRevisionItems(),
})

const draftSeed = (): RevisionDraft[] => [
  { id: 'DRAFT-CHEN', label: '陈锋 · B 版确认', author: '深化员 陈锋', basedOn: 'RB-A', createdAt: '2026-10-01 09:05', status: '保留', batch: draftBatchB(), mapping: bMapping() },
  {
    id: 'DRAFT-ZHAO', label: '赵岚 · B 版确认', author: '深化员 赵岚', basedOn: 'RB-A', createdAt: '2026-10-01 09:05', status: '保留',
    batch: {
      ...draftBatchB(),
      nodes: [...bNodes(), { name: 'J-BX', zone: 'Z-1', state: '允许', renamedFrom: '新增（天窗架预拼）' }],
      revisionItems: [...bRevisionItems(), { id: 'B-R6-ZHAO', type: '节点命名', title: '（个人改动）预留天窗架预拼节点 J-BX', detail: '赵岚在 B 版基础上新增 J-BX 节点，先到生效后该改动保留在个人草稿中。', impactWeldIds: [], impactPlanIds: [], relatedBlockCodes: [] }],
    },
    mapping: bMapping(),
  },
]

const auditSeed = (): AuditEvent[] => [
  { id: 'AE-1', time: '16:38', actor: '赵岚', action: '提交复检', target: 'W-104', detail: '返修后 UT 复检合格，等待审核签字' },
  { id: 'AE-2', time: '15:12', actor: '陈锋', action: '录入缺陷', target: 'W-107', detail: '翼缘板端部夹渣，长度 12mm，Ⅱ级' },
  { id: 'AE-3', time: '14:20', actor: '系统', action: '资质预警', target: 'W-109', detail: '焊工证书 2026-10-01 到期，不得列入后续检测计划' },
  { id: 'AE-0', time: '09-28 17:20', actor: '质量负责人 高岳', action: '签字锁定', target: 'RB-A', detail: 'A 版图纸号、J-A 节点命名、施工区与检测批次按快照锁定' },
]

export interface Seed {
  welds: Weld[]
  plans: InspectionPlan[]
  batches: RevisionBatch[]
  drafts: RevisionDraft[]
  blocks: BlockReason[]
  snapshots: Record<string, BatchSnapshot>
  snapshotList: BatchSnapshot[]
  audit: AuditEvent[]
}

export function buildSeed(): Seed {
  const welds = weldSeed()
  const plans = planSeed(welds)
  const batches = [batchA()]
  const snapshot: BatchSnapshot = {
    batchId: 'RB-A', lockedAt: '2026-09-28 17:20 锁定', lockedBy: '质量负责人 高岳',
    batch: batches[0], welds: structuredClone(welds), plans: structuredClone(plans), blocks: [],
  }
  return { welds, plans, batches, drafts: draftSeed(), blocks: [], snapshots: { 'RB-A': snapshot }, snapshotList: [snapshot], audit: auditSeed() }
}
