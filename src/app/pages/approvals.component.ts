import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TimelineModule } from 'primeng/timeline'
import { TagModule } from 'primeng/tag'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { LockedSnapshot } from '../types'
import { RevisionBannerComponent } from '../components/revision-banner.component'

@Component({
  selector:'app-approvals', standalone:true, imports:[CommonModule,ButtonModule,TimelineModule,TagModule,RevisionBannerComponent],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">签字、版本与追溯</p><h1>逐段确认与锁定</h1><p>审核人按焊缝或检测计划确认、退回或要求复检；锁定后生成只读版本快照，已锁定批次按原快照查看。</p></div><p-button [label]="state.locked ? '已锁定' : '签字锁定检测批次'" icon="pi pi-lock" [disabled]="state.locked" (onClick)="lock()" /></div>
      <app-revision-banner />

      <div class="snapshot-view" *ngIf="viewing as snap">
        <div class="snapshot-view-head">
          <div><i class="pi pi-lock"></i><b>只读快照 · {{snap.batchId}}</b><p>签字锁定于 {{snap.lockedAt}}（{{snap.lockedBy}}），按原图纸号、节点命名与焊缝计划原样查看。</p></div>
          <p-button label="返回当前批次" icon="pi pi-arrow-left" severity="secondary" size="small" (onClick)="closeSnapshot()" />
        </div>
        <div class="snapshot-view-grid">
          <div><span>图纸号</span><b>{{snap.drawingNo}}</b></div>
          <div><span>图版</span><b>{{snap.version}}</b></div>
          <div><span>批次修订</span><b>rev.{{snap.revision}}</b></div>
          <div><span>焊缝</span><b>{{snap.welds.length}} 条</b></div>
          <div><span>检测计划</span><b>{{snap.plans.length}} 个</b></div>
          <div><span>待映射焊缝</span><b class="warn">{{pendingOf(snap)}} 条</b></div>
        </div>
        <div class="snapshot-naming">节点命名：{{snap.nodeNaming}} · 允许施工区：{{snap.allowedZones.join('、')}}</div>
      </div>

      <div class="grid-2"><section class="card"><h2 class="panel-title">待审核焊缝</h2><div class="review" *ngFor="let weld of reviewWelds"><div><b>{{weld.id}} · {{weld.component}}</b><small>{{weld.method}} · {{weld.welder}} · 返修 {{weld.repairs}} 次</small></div><p-tag [value]="weld.status" [severity]="weld.status === '待复检' ? 'warn' : 'danger'" /><p-button label="要求复检" severity="danger" text size="small" /><p-button label="确认合格" size="small" (onClick)="confirm(weld.id)" /></div><p-button label="导出质量追溯包" icon="pi pi-file-export" severity="secondary" styleClass="w-full" /></section>
      <aside class="card"><h2 class="panel-title">完整审计时间线</h2><p-timeline [value]="state.audit" align="left"><ng-template #content let-event><div class="audit"><div><b>{{event.actor}} · {{event.action}}</b><span>{{event.time}}</span></div><p><strong>{{event.target}}</strong> {{event.detail}}</p></div></ng-template></p-timeline></aside></div>

      <section class="card mt-4"><h2 class="panel-title">版本快照与已锁定批次</h2>
        <div class="snapshot"><div><b>v{{state.version}}</b><small>当前工作版本 · {{state.welds.length}} 条焊缝 · {{state.plans.length}} 个检测计划 · 批次 rev.{{state.revision.revision}}</small></div><p-tag [value]="state.locked ? '已签字锁定' : '可编辑'" [severity]="state.locked ? 'success' : 'warn'" /></div>
        <div class="locked-list" *ngIf="state.snapshots.length">
          <h3>已锁定批次（按原快照查看）</h3>
          <div class="locked-row" *ngFor="let snap of state.snapshots">
            <div><b>{{snap.batchId}}</b><p-tag [value]="'图版 ' + snap.version" [severity]="snap.version === 'B' ? 'warn' : 'info'" /><small>rev.{{snap.revision}} · {{snap.welds.length}} 条焊缝 · {{snap.plans.length}} 个计划 · {{snap.lockedAt}} 锁定</small></div>
            <p-button label="查看原快照" icon="pi pi-eye" size="small" [text]="state.viewingBatchId !== snap.batchId" (onClick)="view(snap.batchId)" />
          </div>
        </div>
        <p>版本快照记录焊缝状态、节点映射、缺陷、返修方案、附件哈希和签字人。换版派生新修订，不覆盖原始检测记录；已锁定批次始终按签字时的原快照查看。</p></section>
    </main>
  `,
  styles:[`.review{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid #edf0f5}.review b,.review small{display:block}.review small{color:#7a8798;margin-top:4px}.audit{background:#fff;border:1px solid #e1e7ef;border-radius:6px;padding:10px}.audit>div{display:flex;justify-content:space-between}.audit span{color:#7a8798;font-size:12px}.audit p{margin:5px 0 0;font-size:13px}.snapshot{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px;background:#f8fafc;border-radius:6px}.snapshot b,.snapshot small{display:block}.snapshot small{color:#7a8798;margin-top:4px}.mt-4{margin-top:16px}.snapshot-view{background:#fff;border:1px solid #e1e7ef;border-left:4px solid #16a34a;border-radius:8px;padding:14px 16px;margin-bottom:16px}.snapshot-view-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.snapshot-view-head i{color:#16a34a}.snapshot-view-head p{margin:4px 0 0;font-size:12px}.snapshot-view-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:12px 0}.snapshot-view-grid div{background:#f8fafc;border-radius:6px;padding:8px 10px}.snapshot-view-grid span{display:block;font-size:11px;color:#7a8798}.snapshot-view-grid b{font-size:14px}.snapshot-view-grid b.warn{color:#d97706}.snapshot-naming{font-size:12px;color:#475467}.locked-list{margin:14px 0}.locked-list h3{font-size:14px;margin:0 0 8px}.locked-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #edf0f5}.locked-row>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.locked-row small{color:#7a8798;font-size:12px}@media(max-width:760px){.review{grid-template-columns:1fr auto}.review .p-button{width:100%}.snapshot-view-grid{grid-template-columns:repeat(2,1fr)}}`],
})
export class ApprovalsComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get reviewWelds() { return (this.state?.welds ?? []).filter((item) => ['待复检','返修中','待检测'].includes(item.status)) }
  get viewing(): LockedSnapshot | null { return this.state?.snapshots.find((s) => s.batchId === this.state.viewingBatchId) ?? null }
  pendingOf(snap: LockedSnapshot) { return snap.welds.filter((w) => w.mappingStatus === '待映射').length }
  confirm(id: string) { this.store.dispatch(A.advanceWeld({ id, status:'合格' })) }
  lock() { this.store.dispatch(A.lockBaseline()) }
  view(batchId: string) { this.store.dispatch(A.viewSnapshot({ batchId: this.state.viewingBatchId === batchId ? null : batchId })) }
  closeSnapshot() { this.store.dispatch(A.viewSnapshot({ batchId: null })) }
}
