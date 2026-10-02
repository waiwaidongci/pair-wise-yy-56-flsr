import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TagModule } from 'primeng/tag'
import { DialogModule } from 'primeng/dialog'
import { WeldState } from '../store/weld.reducer'
import { selectBatchView } from '../store/weld.selectors'
import { BatchBannerComponent } from '../components/batch-banner.component'
import * as A from '../store/weld.actions'
import type { PlanEntry, Weld } from '../types'

@Component({
  selector:'app-weld-map', standalone:true, imports:[CommonModule,FormsModule,ButtonModule,TagModule,DialogModule,BatchBannerComponent],
  template:`
    <main class="page">
      <div class="page-head"><div><p class="eyebrow">二维构件定位 · 按批次节点</p><h1>构件焊缝地图</h1><p>图上标签随换版批次显示新节点命名；待映射焊缝保持旧节点号并以红框告警，任务排程同步换版。</p></div><p-button label="批量生成检测计划" icon="pi pi-calendar-plus" [disabled]="!!view.snapshot" (onClick)="planDialog = true" /></div>
      <app-batch-banner />
      <div class="map-grid">
        <section class="card drawing-card">
          <div class="drawing-head"><span>构件图 {{view.batch.drawingNo}}-屋面梁 · {{view.batch.label}}</span><span>节点/施工区为批次冻结数据 · 比例 1:50</span></div>
          <svg viewBox="0 0 100 90" class="weld-map">
            <defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#dbe2ea" stroke-width=".2"/></pattern></defs>
            <rect x="3" y="3" width="94" height="84" fill="url(#grid)" stroke="#334155"/>
            <rect x="3" y="3" width="30" height="84" [attr.fill]="zoneShade('Z-3')" /><rect x="63" y="3" width="34" height="84" [attr.fill]="zoneShade('Z-4')" />
            <path d="M8 20H92M8 42H92M8 66H92" stroke="#94a3b8" stroke-width="4"/><path d="M16 12V78M42 12V78M70 12V78M86 12V78" stroke="#cbd5e1" stroke-width="7"/>
            <text x="18" y="8" class="zone-label">Z-3 {{view.batch.zones['Z-3'] === '暂停' ? '（暂停）' : ''}}</text><text x="76" y="8" class="zone-label">Z-4 {{view.batch.zones['Z-4'] === '暂停' ? '（暂停）' : ''}}</text>
            <g *ngFor="let weld of mapWelds">
              <circle [attr.cx]="weld.x" [attr.cy]="weld.y" r="3.2" [attr.fill]="color(weld)" stroke="#fff" stroke-width="1" (click)="select(weld)" />
              <rect *ngIf="weld.mappingState === '待映射'" [attr.x]="weld.x-4.4" [attr.y]="weld.y-4.4" width="8.8" height="8.8" fill="none" stroke="#dc2626" stroke-width=".8" stroke-dasharray="1.2 1" />
              <text [attr.x]="weld.x+4" [attr.y]="weld.y-4" class="label">{{weld.id}}·{{weld.node}}</text>
              <circle *ngFor="let defect of weld.defects" [attr.cx]="weld.x + defect.position / 30" [attr.cy]="weld.y + 4" r="1.4" fill="#dc2626" />
            </g>
            <text x="50" y="86" class="axis">构件长度方向 → （虚线框 = 待映射焊缝）</text>
          </svg>
        </section>
        <aside class="card">
          <h2 class="panel-title">焊缝明细</h2>
          <div *ngIf="selected" class="detail">
            <div class="detail-head"><div><small>{{selected.drawing}}</small><h3>{{selected.id}} · {{selected.component}}</h3></div><p-tag [value]="selected.status" [severity]="selected.status === '合格' || selected.status === '已关闭' ? 'success' : selected.status === '返修中' ? 'danger' : 'warn'" /></div>
            <div class="kv"><span>批次节点</span><b [class.danger]="selected.mappingState === '待映射'">{{selected.node}}（{{selected.batchId}}）</b></div>
            <div class="kv"><span>节点更名</span><b>{{selected.nodeA}}<ng-container *ngIf="selected.nodeB"> → {{selected.nodeB}}</ng-container><ng-container *ngIf="!selected.nodeB && selected.mappingState === '待映射'"> · B 版无新节点</ng-container></b></div>
            <div class="kv"><span>施工区</span><b [class.danger]="selected.zoneState === '暂停'">{{selected.zone}} · {{selected.zoneState}}</b></div>
            <div class="kv"><span>映射状态</span><b><p-tag [value]="selected.mappingState" [severity]="selected.mappingState === '待映射' ? 'danger' : 'success'" /></b></div>
            <p class="map-note" *ngIf="selected.mappingState === '待映射'">{{selected.mappingNote}}</p>
            <div class="kv"><span>焊接方法</span><b>{{selected.method}} / {{selected.joint}}</b></div>
            <div class="kv"><span>焊工</span><b>{{selected.welder}}</b></div>
            <div class="kv"><span>检测比例</span><b [class.danger]="selected.inspectionRatio < selected.requiredRatio">{{selected.inspectionRatio}}% / {{selected.requiredRatio}}%</b></div>
            <h3>缺陷记录</h3>
            <div *ngFor="let defect of selected.defects" class="defect"><b>{{defect.id}} · {{defect.type}}</b><p>位置 {{defect.position}}% · 长度 {{defect.length}}mm · {{defect.level}} · {{defect.method}}</p></div>
            <p class="muted" *ngIf="!selected.defects.length">当前无未关闭缺陷。</p>
          </div>
        </aside>
      </div>
      <p-dialog header="按 B 版批量生成检测计划" [(visible)]="planDialog" [modal]="true" [style]="{width:'560px'}">
        <div class="dialog-form">
          <label>检测方法</label><select [(ngModel)]="form.method"><option>UT 超声检测</option><option>MT 磁粉检测</option><option>UT + MT</option></select>
          <label>计划日期</label><input type="date" [(ngModel)]="form.date" />
          <label>检测人员</label><select [(ngModel)]="form.inspector"><option>陈锋</option><option>赵岚</option></select>
          <p>计划条目按当前批次（{{state.activeBatchId}}）的节点命名与施工区写入；待映射、暂停区焊缝会被重算标记并阻断，不会静默剔除。</p>
        </div>
        <ng-template #footer><p-button label="取消" severity="secondary" (onClick)="planDialog = false" /><p-button label="生成计划" (onClick)="createPlan()" /></ng-template>
      </p-dialog>
    </main>
  `,
  styles:[`.map-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(330px,.7fr);gap:16px}.drawing-card{padding:0;overflow:hidden}.drawing-head{display:flex;justify-content:space-between;padding:13px 16px;background:#f8fafc;border-bottom:1px solid #e1e7ef;color:#64748b;font-size:13px}.weld-map{width:100%;height:min(62vh,640px);display:block;background:#fff}.weld-map circle{cursor:pointer}.label{font-size:2.3px;font-weight:700;fill:#334155}.zone-label{font-size:2.6px;fill:#64748b;font-weight:700}.axis{font-size:2.2px;fill:#94a3b8}.detail-head{display:flex;justify-content:space-between}.detail-head small{color:#7a8798}.detail-head h3{margin:5px 0}.kv{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #edf0f5}.kv span{color:#667085;flex-shrink:0}.map-note{margin:8px 0 0;padding:8px 10px;background:#fef2f2;color:#b91c1c;border-radius:5px;font-size:12.5px;line-height:1.5}.defect{margin-top:10px;padding:10px;background:#fff1f2;border-left:3px solid #ef4444;border-radius:5px}.defect p{margin:4px 0 0;font-size:13px}.dialog-form{display:grid;gap:8px}.dialog-form input,.dialog-form select{padding:9px;border:1px solid #cbd5e1;border-radius:6px}.muted{color:#7a8798}`],
})
export class WeldMapComponent {
  readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  planDialog = false
  form = { method: 'UT + MT', date: '2026-10-02', inspector: '陈锋' }
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get view() { return selectBatchView(this.state) }
  get mapWelds() { return this.view.welds.filter((w) => w.drawing.includes('SG-07')) }
  get selected() { return this.view.welds.find((item) => item.id === this.state.selectedId) }
  select(weld: Weld) { this.store.dispatch(A.selectWeld({ id: weld.id })) }
  zoneShade(zone: string) {
    if (this.view.snapshot) return this.view.batch.zones[zone] === '暂停' ? '#f8fafc' : 'rgba(37,99,235,0.05)'
    return this.view.batch.zones[zone] === '暂停' ? 'rgba(220,38,38,0.07)' : 'rgba(37,99,235,0.05)'
  }
  color(weld: Weld) {
    if (weld.mappingState === '待映射') return '#dc2626'
    return weld.status === '合格' || weld.status === '已关闭' ? '#16a34a' : weld.status === '返修中' || !weld.qualificationValid ? '#dc2626' : weld.status === '待复检' ? '#7c3aed' : '#f59e0b'
  }
  createPlan() {
    const batch = this.view.activeBatch
    const welds = this.state.welds.filter((w) => batch.scopeDrawings.includes(w.drawing) && w.status === '待检测')
    const entries: PlanEntry[] = welds.map((w) => ({
      weldId: w.id, node: w.node, zone: w.zone,
      valid: w.mappingState === '已映射' && w.zoneState === '允许',
      flag: w.mappingState === '待映射' ? '已阻断' : w.zoneState === '暂停' ? '需重新排期' : '已重算',
      blockCode: w.mappingState === '待映射' ? 'NODE_UNMAPPED' : w.zoneState === '暂停' ? 'ZONE_PAUSED' : undefined,
      blockReason: w.mappingState === '待映射' ? `B 版无对应节点，台账暂挂旧节点 ${w.node}` : w.zoneState === '暂停' ? `施工区 ${w.zone} 已暂停` : undefined,
      writeState: '待写入',
    }))
    this.store.dispatch(A.createPlan({ plan: {
      id: `IP-${Date.now().toString().slice(-6)}`, date: this.form.date, method: this.form.method,
      inspector: this.form.inspector, state: '待执行', batchId: batch.id, writeState: '正常', entries, confirmedEntries: [],
    } }))
    this.planDialog = false
  }
}
