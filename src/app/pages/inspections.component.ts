import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { TableModule } from 'primeng/table'
import { TagModule } from 'primeng/tag'
import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { InputTextModule } from 'primeng/inputtext'
import { TextareaModule } from 'primeng/textarea'
import { SelectButtonModule } from 'primeng/selectbutton'
import { WeldState } from '../store/weld.reducer'
import { selectBatchView } from '../store/weld.selectors'
import { BatchBannerComponent } from '../components/batch-banner.component'
import * as A from '../store/weld.actions'
import type { InspectionPlan } from '../types'

@Component({
  selector:'app-inspections', standalone:true, imports:[CommonModule,FormsModule,TableModule,TagModule,ButtonModule,DialogModule,InputTextModule,TextareaModule,SelectButtonModule,BatchBannerComponent],
  template:`
    <main class="page">
      <div class="page-head"><div><p class="eyebrow">NDT / 返修闭环 · 换版重算</p><h1>检测计划与返修</h1><p>图纸版本一变，未完工计划立即按新节点重算；写入失败后从已确认条目恢复，锁定批次按快照查看。</p></div></div>
      <app-batch-banner />

      <section class="card mb-4">
        <div class="toolbar"><h2 class="panel-title">批量检测计划（随换版批次重算）</h2><span class="spacer"></span>
          <p-button label="模拟计划写入失败" icon="pi pi-cloud-slash" severity="danger" [outlined]="true" [disabled]="!view.isActive || !activePlan" (onClick)="failWrite()" />
          <p-button label="从已确认条目恢复" icon="pi pi-rotate-left" severity="warn" [outlined]="true" [disabled]="!failedPlan" (onClick)="recover()" />
        </div>
        <p class="hint">已完工计划不参与重算；条目写状态为「待写入/写入失败/已恢复/已确认」，恢复基线始终保留。</p>
        <p-table [value]="view.plans" [rowHover]="true" dataKey="id">
          <ng-template #header><tr><th>计划编号 / 批次</th><th>日期</th><th>方法</th><th>检测人</th><th>计划状态</th><th>写状态</th><th>明细（换版节点 / 重算结果）</th></tr></ng-template>
          <ng-template #body let-plan>
            <tr [class.failed]="plan.writeState === '写入失败'">
              <td><b>{{plan.id}}</b><small class="block">{{plan.batchId}}<ng-container *ngIf="plan.recomputedFor"> · 已按 {{plan.recomputedFor}} 重算</ng-container></small></td>
              <td>{{plan.date}}</td><td>{{plan.method}}</td><td>{{plan.inspector}}</td>
              <td><p-tag [value]="plan.state" [severity]="plan.state === '已完成' ? 'success' : plan.state === '执行中' ? 'info' : 'warn'" /></td>
              <td>
                <p-tag [value]="plan.writeState" [severity]="plan.writeState === '正常' ? 'success' : 'danger'" />
                <small class="block" *ngIf="plan.writeState === '写入失败'">等待从确认基线恢复</small>
              </td>
              <td>
                <div class="entries">
                  <span class="entry" *ngFor="let e of plan.entries" [class.bad]="!e.valid" [class.done]="plan.state === '已完成'">
                    <b>{{e.weldId}}·{{e.node}}</b>
                    <small>{{e.zone}}</small>
                    <em *ngIf="plan.state !== '已完成' && e.writeState !== '已确认'">{{e.writeState}}</em>
                    <em class="ok" *ngIf="e.writeState === '已确认'">已确认</em>
                    <i class="flag" *ngIf="e.flag && plan.state !== '已完成'">{{e.flag}}</i>
                    <i class="reason" *ngIf="!e.valid && e.blockReason">{{e.blockReason}}</i>
                  </span>
                  <span class="entry done" *ngIf="plan.state === '已完成'">已完工计划不重算，保留原节点</span>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
        <p class="recover-note" *ngIf="lastError">
          <span class="pi pi-exclamation-circle"></span>{{lastError.time}} {{lastError.planId}} 写入失败：{{lastError.detail}}
          <ng-container *ngIf="lastError.restored"> · 已从确认条目恢复 {{lastError.restored}} 条（标记“已恢复”），需复核换版差异后再次确认。</ng-container>
        </p>
      </section>

      <div class="grid-2">
        <section class="card">
          <h2 class="panel-title">返修状态流转（可阻断项）</h2>
          <div class="step" *ngFor="let weld of repairWelds">
            <div><b>{{weld.id}} · {{weld.component}}</b><small>{{weld.node}} · {{weld.zone}} · {{weld.defects.length}} 个缺陷 · 已返修 {{weld.repairs}} 次</small></div>
            <p-tag [value]="weld.mappingState" [severity]="weld.mappingState === '待映射' ? 'danger' : 'success'" />
            <p-tag [value]="weld.zoneState" [severity]="weld.zoneState === '暂停' ? 'danger' : 'info'" />
            <p-selectbutton [options]="['返修中','待复检','合格']" [ngModel]="weld.status" (ngModelChange)="advance(weld.id,$event)" />
          </div>
          <p class="empty" *ngIf="!repairWelds.length">当前批次没有返修中/待复检焊缝。</p>
        </section>
        <aside class="card">
          <h2 class="panel-title">检测结果与缺陷明细</h2>
          <p-table [value]="defects" [paginator]="true" [rows]="6">
            <ng-template #header><tr><th>缺陷编号</th><th>焊缝/节点</th><th>位置 / 长度</th><th>类型 / 等级</th><th>报告</th><th>处置</th></tr></ng-template>
            <ng-template #body let-item>
              <tr><td>{{item.defect.id}}</td><td>{{item.weld.id}}<small class="block">{{item.weld.node}}</small></td><td>{{item.defect.position}}% · {{item.defect.length}}mm</td><td>{{item.defect.type}} · {{item.defect.level}}</td><td>{{item.defect.method}}<small class="block">{{item.defect.report}}</small></td><td><p-button label="确认复检" size="small" (onClick)="advance(item.weld.id,'合格')" /></td></tr>
            </ng-template>
          </p-table>
        </aside>
      </div>
    </main>
  `,
  styles:[`.mb-4{margin-bottom:16px}.hint{font-size:12.5px;color:#7a8798;margin:0 0 10px}.block{display:block;color:#7a8798;margin-top:2px}.failed{background:#fef2f2}.entries{display:flex;flex-direction:column;gap:5px}.entry{display:inline-flex;align-items:baseline;gap:7px;flex-wrap:wrap;font-size:12.5px;border:1px solid #e1e7ef;border-radius:5px;padding:4px 8px;background:#fbfdff}.entry b{font-size:12.5px}.entry small{color:#64748b}.entry em{font-style:normal;color:#b45309;font-size:11px}.entry em.ok{color:#15803d}.entry .flag{font-style:normal;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 6px;font-size:11px}.entry .reason{font-style:normal;color:#b91c1c;font-size:11.5px}.entry.bad{border-color:#fca5a5;background:#fef2f2}.entry.done{border-style:dashed}.recover-note{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 0;font-size:13px;color:#b91c1c;background:#fef2f2;border-radius:6px;padding:9px 12px}.step{display:grid;grid-template-columns:1fr auto auto;gap:9px;align-items:center;padding:12px 0;border-bottom:1px solid #edf0f5}.step>div,.step small{display:block}.step small{color:#7a8798;margin-top:4px}.step p-selectbutton{grid-column:1/-1}.empty{font-size:13px;color:#7a8798}`],
})
export class InspectionsComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get view() { return selectBatchView(this.state) }
  get repairWelds() { return this.view.welds.filter((item) => ['返修中','待复检'].includes(item.status)) }
  get defects() { return this.view.welds.flatMap((weld) => weld.defects.map((defect) => ({ weld, defect }))) }
  get activePlan(): InspectionPlan | undefined {
    const unfinished = this.state.plans.filter((p) => p.batchId === this.state.activeBatchId && p.state !== '已完成' && p.writeState === '正常')
    // 优先选有确认基线的计划，保证“写入失败 → 从已确认条目恢复”可完整演示
    return unfinished.find((p) => p.confirmedEntries.length) ?? unfinished[0]
  }
  get failedPlan() {
    return this.state.plans.find((p) => p.writeState === '写入失败')
  }
  get lastError() {
    return this.state.writeErrors[this.state.writeErrors.length - 1]
  }
  failWrite() {
    const plan = this.activePlan
    if (plan) this.store.dispatch(A.planWriteFailed({ planId: plan.id, detail: '检测计划写入检测班组排程服务超时（connection timeout 504）' }))
  }
  recover() {
    if (this.failedPlan) this.store.dispatch(A.recoverPlanFromConfirmed({ planId: this.failedPlan.id }))
  }
  advance(id: string, status: string) { this.store.dispatch(A.advanceWeld({ id, status: status as never })) }
}
