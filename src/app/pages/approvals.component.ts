import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TimelineModule } from 'primeng/timeline'
import { TagModule } from 'primeng/tag'
import { WeldState } from '../store/weld.reducer'
import { canLock, lockBlockers, selectBatchView } from '../store/weld.selectors'
import { BatchBannerComponent } from '../components/batch-banner.component'
import * as A from '../store/weld.actions'

@Component({
  selector:'app-approvals', standalone:true, imports:[CommonModule,ButtonModule,TimelineModule,TagModule,BatchBannerComponent],
  template:`
    <main class="page">
      <div class="page-head"><div><p class="eyebrow">签字、版本与追溯</p><h1>逐段确认与换版锁定</h1><p>发版固定图纸号、节点命名与允许施工区；阻断清零后签字锁定，锁定批次永远按原快照只读查看。</p></div>
        <p-button [label]="view.isActive ? (lockable ? '签字锁定当前批次' : '存在阻断，无法锁定') : '当前为快照只读视图'" icon="pi pi-lock" [severity]="lockable ? 'primary' : 'secondary'" [disabled]="!lockable" (onClick)="lock()" />
      </div>
      <app-batch-banner />

      <div class="grid-2">
        <section class="card">
          <h2 class="panel-title">批次锁定检查单（{{state.activeBatchId}}）</h2>
          <div class="check" *ngFor="let c of checks">
            <span class="pi" [class.pi-check-circle]="c.ok" [class.pi-times-circle]="!c.ok" [class.ok]="c.ok"></span>
            <div><b>{{c.title}}</b><p>{{c.detail}}</p></div>
            <p-tag [value]="c.ok ? '通过' : '阻断'" [severity]="c.ok ? 'success' : 'danger'" />
          </div>
          <div class="blockers" *ngIf="!lockable">
            <b>锁定被阻断：</b>
            <ul><li *ngFor="let m of blockers">{{m}}</li></ul>
          </div>
          <p class="ok-note" *ngIf="lockable">检查全部通过：签字后生成只读快照，后续修订只能从该批次派生新版，不得覆盖原始检测记录。</p>
        </section>
        <aside class="card">
          <h2 class="panel-title">批次快照（锁定后只读）</h2>
          <div class="snap" *ngFor="let b of state.batches">
            <div>
              <b>{{b.label}}</b>
              <small *ngIf="state.snapshots[b.id]">{{state.snapshots[b.id].lockedAt}} · {{state.snapshots[b.id].lockedBy}} · {{state.snapshots[b.id].welds.length}} 条焊缝 / {{state.snapshots[b.id].plans.length}} 个计划</small>
              <small *ngIf="!state.snapshots[b.id] && b.status !== '已锁定'">尚未锁定，无快照</small>
            </div>
            <p-tag [value]="b.status" [severity]="b.status === '已锁定' ? 'success' : b.status === '已生效' ? 'info' : 'warn'" />
            <p-button [label]="state.snapshots[b.id] ? '按原快照查看' : '查看工作态'" [text]="true" size="small" (onClick)="switchBatch(b.id)" />
          </div>
          <p class="hint">从上方切换批次后，台账、地图、检测计划四个页面均显示该批次的同批修订与阻断原因；锁定批次始终读取快照，不随后续换版改变。</p>
        </aside>
      </div>

      <div class="grid-2 mt-4">
        <section class="card">
          <h2 class="panel-title">完整审计时间线</h2>
          <p-timeline [value]="state.audit" align="left">
            <ng-template #content let-event><div class="audit"><div><b>{{event.actor}} · {{event.action}}</b><span>{{event.time}}</span></div><p><strong>{{event.target}}</strong> {{event.detail}}</p></div></ng-template>
          </p-timeline>
        </section>
        <aside class="card">
          <h2 class="panel-title">换版并发裁决</h2>
          <div class="draft" *ngFor="let d of state.drafts">
            <div class="draft-head"><b>{{d.label}}</b><p-tag [value]="d.status === '已采纳' ? '先到生效' : d.conflict ? '后到冲突' : '待提交'" [severity]="d.status === '已采纳' ? 'success' : d.conflict ? 'danger' : 'warn'" /></div>
            <small>基于 {{d.basedOn}} · 保存于 {{d.createdAt}}</small>
            <p *ngIf="!d.conflict" class="muted">两名深化员各自保存 B 版确认草稿；先提交者换版生效。</p>
            <div class="conflict-box" *ngIf="d.conflict">
              <b>{{d.conflict.reason}}</b>
              <p>{{d.conflict.changes}}</p>
              <small>个人改动完整保留在草稿中，未被先到结果覆盖；可比对后发起 C 版。</small>
            </div>
          </div>
        </aside>
      </div>
    </main>
  `,
  styles:[`.check{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid #edf0f5}.check .pi{font-size:18px;color:#dc2626}.check .pi.ok{color:#16a34a}.check b{font-size:14px}.check p{margin:3px 0 0;font-size:12.5px;color:#667085;line-height:1.45}.blockers{margin-top:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 12px}.blockers ul{margin:6px 0 0;padding-left:18px}.blockers li{font-size:13px;color:#b91c1c;margin:3px 0}.ok-note{margin-top:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 12px;color:#15803d;font-size:13px}.snap{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:11px 0;border-bottom:1px solid #edf0f5}.snap b,.snap small{display:block}.snap small{color:#7a8798;margin-top:4px;font-size:12px}.hint{font-size:12.5px;color:#7a8798;margin-top:12px;line-height:1.6}.audit{background:#fff;border:1px solid #e1e7ef;border-radius:6px;padding:10px}.audit>div{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}.audit span{color:#7a8798;font-size:12px}.audit p{margin:5px 0 0;font-size:13px;line-height:1.5}.draft{border:1px solid #e1e7ef;border-radius:7px;padding:11px;margin-bottom:10px}.draft-head{display:flex;justify-content:space-between;align-items:center}.draft small{color:#7a8798}.muted{font-size:12.5px;color:#7a8798;margin:6px 0 0}.conflict-box{margin-top:8px;border-left:3px solid #dc2626;background:#fef2f2;border-radius:5px;padding:9px}.conflict-box b{font-size:13px;color:#b91c1c}.conflict-box p{margin:5px 0;font-size:13px}.conflict-box small{color:#667085;line-height:1.5}.mt-4{margin-top:16px}`],
})
export class ApprovalsComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get view() { return selectBatchView(this.state) }
  get lockable() { return canLock(this.state) }
  get blockers() { return lockBlockers(this.state) }
  get checks() {
    const blocks = this.state.blocks
    const batch = this.state.batches.find((b) => b.id === this.state.activeBatchId)
    const unfinished = this.state.plans.filter((p) => p.state !== '已完成')
    const badEntries = unfinished.flatMap((p) => p.entries).filter((e) => !e.valid)
    const failed = this.state.plans.some((p) => p.writeState === '写入失败')
    return [
      { ok: !!batch && batch.status === '已生效', title: '图纸版本与节点命名已发版固定', detail: batch ? `${batch.drawingNo} · ${batch.nodes.length} 个节点随批次冻结，允许施工区 ${batch.allowedZones.join('、')}` : '尚未换版' },
      { ok: !blocks.some((b) => b.code === 'NODE_UNMAPPED' && b.severity === '阻断'), title: '焊缝映射无待映射阻断', detail: '无新节点的旧焊缝已回填待映射并补录；历史数据保留不丢失。' },
      { ok: !blocks.some((b) => b.code === 'ZONE_PAUSED'), title: '暂停施工区已放行或改期', detail: '未完工计划不再指向暂停施工区（已重算改期）。' },
      { ok: badEntries.length === 0, title: '未完工计划重算后无阻断明细', detail: badEntries.length ? `仍有 ${badEntries.length} 条明细阻断：${badEntries.map((e) => `${e.weldId}/${e.blockCode}`).join('、')}` : '待执行/执行中计划全部可写入。' },
      { ok: !failed, title: '计划写入失败已恢复', detail: failed ? '存在写入失败的计划，必须先从已确认条目恢复。' : '所有计划写状态正常（或已恢复）。' },
    ]
  }
  lock() { this.store.dispatch(A.lockBaseline()) }
  switchBatch(batchId: string) { this.store.dispatch(A.viewBatch({ batchId })) }
}
