import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Store } from '@ngrx/store'
import { TableModule } from 'primeng/table'
import { TagModule } from 'primeng/tag'
import { ButtonModule } from 'primeng/button'
import { SelectModule } from 'primeng/select'
import { FormsModule } from '@angular/forms'
import { WeldState } from '../store/weld.reducer'
import { selectBatchView } from '../store/weld.selectors'
import { BatchBannerComponent } from '../components/batch-banner.component'
import * as A from '../store/weld.actions'
import type { Weld } from '../types'

@Component({
  selector:'app-overview', standalone:true, imports:[CommonModule,FormsModule,TableModule,TagModule,ButtonModule,SelectModule,BatchBannerComponent],
  template:`
    <main class="page">
      <div class="page-head"><div><p class="eyebrow">焊缝、资质与检测比例</p><h1>焊缝台账总览</h1><p>按换版批次管理构件焊缝：图纸版本变化时节点号随批更名，无新节点的旧焊缝回填“待映射”，不静默丢失。</p></div><p-button label="批量导入焊缝" icon="pi pi-upload" severity="secondary" /></div>
      <app-batch-banner />
      <div class="grid-4">
        <article class="card metric"><span>台账焊缝</span><strong>{{view.welds.length}}</strong><small>当前视图：{{view.batch.label}}</small></article>
        <article class="card metric"><span>待检测 / 返修</span><strong class="warning">{{pending}}</strong><small>未完工计划随换版立即重算</small></article>
        <article class="card metric"><span>待映射焊缝</span><strong [class.danger]="unmapped > 0">{{unmapped}}</strong><small>暂挂旧节点号，等待补录</small></article>
        <article class="card metric"><span>批次阻断 / 预警</span><strong [class.danger]="blocking > 0">{{blocking}} / {{warnings}}</strong><small>{{view.snapshot ? '快照只读' : '阻断清零后可锁定'}}</small></article>
      </div>
      <section class="card">
        <div class="toolbar">
          <p-select [options]="statusOptions" [(ngModel)]="filter" (ngModelChange)="applyFilter($event)" placeholder="筛选状态" styleClass="w-full md:w-40" />
          <p-select [options]="mappingOptions" [(ngModel)]="mappingFilter" placeholder="映射状态" styleClass="w-full md:w-40" />
          <span class="spacer"></span><p-button label="导出焊缝台账" icon="pi pi-file-excel" severity="secondary" />
        </div>
        <p-table [value]="filtered" [paginator]="true" [rows]="8" selectionMode="single" (onRowSelect)="select($event.data)" dataKey="id">
          <ng-template #header><tr><th>焊缝 / 构件</th><th>批次节点 / 施工区</th><th>方法与焊工</th><th>检测</th><th>返修</th><th>映射 / 状态</th></tr></ng-template>
          <ng-template #body let-weld>
            <tr>
              <td><b>{{weld.id}}</b><small class="block">{{weld.drawing}} · {{weld.component}}</small></td>
              <td>
                <b [class.danger]="weld.mappingState === '待映射'">{{weld.node}}</b>
                <small class="block">A版 {{weld.nodeA}}<ng-container *ngIf="weld.nodeB"> → B版 {{weld.nodeB}}</ng-container></small>
                <small class="block"><span class="zone-dot" [class.paused]="weld.zoneState === '暂停'"></span>{{weld.zone}} {{weld.zoneState}} · 批次 {{weld.batchId}}</small>
              </td>
              <td>{{weld.method}} · {{weld.welder}}<small class="block" [class.danger]="!weld.qualificationValid">{{weld.qualificationValid ? '资质有效' : '资质今日到期'}}</small></td>
              <td><b [class.danger]="weld.inspectionRatio < weld.requiredRatio">{{weld.inspectionRatio}}% / {{weld.requiredRatio}}%</b><small class="block">要求检测比例</small></td>
              <td>{{weld.repairs}} 次<small class="block" *ngIf="weld.repairs >= 2">重复返修关注</small></td>
              <td>
                <p-tag [value]="weld.mappingState" [severity]="weld.mappingState === '待映射' ? 'danger' : 'success'" /><br />
                <p-tag [value]="weld.status" [severity]="weld.status === '合格' || weld.status === '已关闭' ? 'success' : weld.status === '返修中' ? 'danger' : 'warn'" styleClass="mt-1" />
                <small class="block note" *ngIf="weld.mappingState === '待映射'">{{weld.mappingNote}}</small>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </section>
    </main>
  `,
  styles:[`.block{display:block;color:#7a8798;margin-top:3px}.note{color:#b91c1c;max-width:240px;line-height:1.4}.zone-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#16a34a;margin-right:4px}.zone-dot.paused{background:#dc2626}.mt-1{margin-top:4px}`],
})
export class OverviewComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  filter = '全部'
  mappingFilter = '全部'
  statusOptions = ['全部','待检测','合格','返修中','待复检','已关闭']
  mappingOptions = ['全部','已映射','待映射']
  constructor() {
    this.store.select('welds').subscribe((state) => this.state = state)
  }
  get view() { return selectBatchView(this.state) }
  get filtered() {
    const rows = this.view.welds
    return rows
      .filter((item) => this.filter === '全部' || item.status === this.filter)
      .filter((item) => this.mappingFilter === '全部' || item.mappingState === this.mappingFilter)
  }
  get pending() { return this.view.welds.filter((item) => ['待检测','返修中','待复检'].includes(item.status)).length }
  get unmapped() { return this.view.welds.filter((item) => item.mappingState === '待映射').length }
  get blocking() { return this.view.blocks.filter((b) => b.severity === '阻断').length }
  get warnings() { return this.view.blocks.filter((b) => b.severity === '预警').length }
  applyFilter(status: string) { this.store.dispatch(A.filterStatus({ status })) }
  select(weld: Weld | Weld[] | undefined) { if (weld && !Array.isArray(weld)) this.store.dispatch(A.selectWeld({ id: weld.id })) }
}
