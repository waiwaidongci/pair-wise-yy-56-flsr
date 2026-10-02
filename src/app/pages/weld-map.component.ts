import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TagModule } from 'primeng/tag'
import { DialogModule } from 'primeng/dialog'
import { AccordionModule } from 'primeng/accordion'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { InspectionPlan, Weld } from '../types'
import { RevisionBannerComponent } from '../components/revision-banner.component'

@Component({
  selector:'app-weld-map', standalone:true, imports:[CommonModule,ButtonModule,TagModule,DialogModule,AccordionModule,RevisionBannerComponent],
  template:`
    <main class="page"><div class="page-head"><div><p class="eyebrow">二维构件定位</p><h1>构件焊缝地图</h1><p>在构件展开图上定位焊缝、缺陷和返修位置，颜色代表当前质量状态；灰点为换版后待映射焊缝，不得列入检测计划。</p></div><p-button label="批量生成检测计划" icon="pi pi-calendar-plus" (onClick)="planDialog = true" /></div>
      <app-revision-banner />
      <div class="map-grid"><section class="card drawing-card"><div class="drawing-head"><span>构件图 {{state.revision.drawingNo}} · {{state.revision.version === 'B' ? 'B 版（屋面）' : 'A 版'}} · 展开示意</span><span>单位：mm · 比例 1:50</span></div><svg viewBox="0 0 100 90" class="weld-map"><defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#dbe2ea" stroke-width=".2"/></pattern></defs><rect x="3" y="3" width="94" height="84" fill="url(#grid)" stroke="#334155"/><path d="M8 20H92M8 42H92M8 66H92" stroke="#94a3b8" stroke-width="4"/><path d="M16 12V78M42 12V78M70 12V78M86 12V78" stroke="#cbd5e1" stroke-width="7"/><g *ngFor="let weld of state.welds"><circle [attr.cx]="weld.x" [attr.cy]="weld.y" r="3.2" [attr.fill]="color(weld)" [attr.stroke]="weld.mappingStatus === '待映射' ? '#dc2626' : '#fff'" [attr.stroke-width]="weld.mappingStatus === '待映射' ? 1.4 : 1" [attr.stroke-dasharray]="weld.mappingStatus === '待映射' ? '1.2 1' : null" (click)="select(weld)" /><text [attr.x]="weld.x+4" [attr.y]="weld.y-4" class="label">{{weld.id}}</text><circle *ngFor="let defect of weld.defects" [attr.cx]="weld.x + defect.position / 30" [attr.cy]="weld.y + 4" r="1.4" fill="#dc2626" /></g><text x="50" y="86" class="axis">构件长度方向 →</text></svg></section>
        <aside class="card"><h2 class="panel-title">焊缝明细</h2><div *ngIf="selected" class="detail"><div class="detail-head"><div><small>{{selected.drawing}}</small><h3>{{selected.id}} · {{selected.component}}</h3></div><p-tag [value]="selected.status" [severity]="selected.status === '合格' || selected.status === '已关闭' ? 'success' : selected.status === '返修中' ? 'danger' : 'warn'" /></div><div class="kv"><span>节点号</span><b>{{selected.node}}</b></div><div class="kv"><span>换版映射</span><b><p-tag [value]="selected.mappingStatus" [severity]="selected.mappingStatus === '待映射' ? 'warn' : 'success'" /></b></div><div class="mapping-note" *ngIf="selected.mappingStatus === '待映射'"><i class="pi pi-exclamation-triangle"></i>B 版节点命名中无此节点，已回填「待映射」，旧节点号保留；不得列入检测计划。</div><div class="kv"><span>焊接方法</span><b>{{selected.method}} / {{selected.joint}}</b></div><div class="kv"><span>焊工</span><b>{{selected.welder}}</b></div><div class="kv"><span>检测比例</span><b [class.danger]="selected.inspectionRatio < selected.requiredRatio">{{selected.inspectionRatio}}% / {{selected.requiredRatio}}%</b></div><div class="kv"><span>返修次数</span><b>{{selected.repairs}}</b></div><h3>缺陷记录</h3><div *ngFor="let defect of selected.defects" class="defect"><b>{{defect.id}} · {{defect.type}}</b><p>位置 {{defect.position}}% · 长度 {{defect.length}}mm · {{defect.level}} · {{defect.method}}</p></div><p class="muted" *ngIf="!selected.defects.length">当前无未关闭缺陷。</p><p-button label="进入返修闭环" icon="pi pi-wrench" styleClass="w-full" /></div></aside></div>
      <p-dialog header="生成批量检测计划" [(visible)]="planDialog" [modal]="true" [style]="{width:'560px'}"><div class="dialog-form"><label>检测方法</label><select><option>UT 超声检测</option><option>MT 磁粉检测</option><option>UT + MT</option></select><label>计划日期</label><input type="date" value="2026-10-02" /><label>检测人员</label><select><option>陈锋</option><option>赵岚</option></select><p>系统将排除资质即将到期焊工完成的焊缝；含待映射节点的计划将被服务端拒绝写入，并从已确认条目恢复。</p></div><ng-template #footer><p-button label="取消" severity="secondary" (onClick)="planDialog = false" /><p-button label="生成计划" (onClick)="createPlan()" /></ng-template></p-dialog>
    </main>
  `,
  styles:[`.map-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(310px,.65fr);gap:16px}.drawing-card{padding:0;overflow:hidden}.drawing-head{display:flex;justify-content:space-between;gap:10px;padding:13px 16px;background:#f8fafc;border-bottom:1px solid #e1e7ef;color:#64748b;font-size:13px}.weld-map{width:100%;height:min(68vh,680px);display:block;background:#fff}.weld-map circle{cursor:pointer}.label{font-size:2.4px;font-weight:700;fill:#334155}.axis{font-size:2.2px;fill:#94a3b8}.detail-head{display:flex;justify-content:space-between}.detail-head small{color:#7a8798}.detail-head h3{margin:5px 0}.kv{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #edf0f5}.kv span{color:#667085}.mapping-note{display:flex;gap:7px;align-items:flex-start;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;margin:8px 0;font-size:12px;color:#92400e}.mapping-note i{color:#d97706;margin-top:1px}.defect{margin-top:10px;padding:10px;background:#fff1f2;border-left:3px solid #ef4444;border-radius:5px}.defect p{margin:4px 0 0;font-size:13px}.dialog-form{display:grid;gap:8px}.dialog-form input,.dialog-form select{padding:9px;border:1px solid #cbd5e1;border-radius:6px}.muted{color:#7a8798}`],
})
export class WeldMapComponent {
  readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState
  planDialog = false
  constructor() { this.store.select('welds').subscribe((state) => this.state = state) }
  get selected() { return this.state?.welds.find((item) => item.id === this.state.selectedId) }
  select(weld: Weld) { this.store.dispatch(A.selectWeld({ id: weld.id })) }
  color(weld: Weld) {
    if (weld.mappingStatus === '待映射') return '#94a3b8'
    return weld.status === '合格' || weld.status === '已关闭' ? '#16a34a' : weld.status === '返修中' || !weld.qualificationValid ? '#dc2626' : weld.status === '待复检' ? '#7c3aed' : '#f59e0b'
  }

  /** 计划写入：先乐观写入，服务端按节点映射校验；拒绝则从已确认条目恢复 */
  createPlan() {
    const weldIds = this.state.welds.slice(0, 2).map((w) => w.id)
    const plan: InspectionPlan = {
      id: `IP-${Date.now().toString().slice(-6)}`, date: '2026-10-02', method: 'UT + MT',
      weldIds, inspector: '陈锋', state: '待执行',
      batchId: this.state.revision.batchId, blocked: false, blockReason: null,
    }
    this.store.dispatch(A.planWriteRequested({ plan }))
    this.planDialog = false
    setTimeout(() => {
      const unresolved = weldIds.filter((id) => {
        const weld = this.state.welds.find((w) => w.id === id)
        return !weld || weld.mappingStatus === '待映射'
      })
      if (unresolved.length) {
        this.store.dispatch(A.planWriteFailed({ plan, reason: `焊缝 ${unresolved.join('、')} 在当前批次无新节点（待映射），计划不得写入` }))
      } else {
        this.store.dispatch(A.planWriteConfirmed({ plan }))
      }
    }, 450)
  }
}
