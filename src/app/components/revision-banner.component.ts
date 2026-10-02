import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Store } from '@ngrx/store'
import { TagModule } from 'primeng/tag'
import { ButtonModule } from 'primeng/button'
import { WeldState } from '../store/weld.reducer'
import * as A from '../store/weld.actions'
import type { Weld } from '../types'

/**
 * 换版批次横幅：四个页面共用，显示同一批图纸版本修订与阻断原因。
 * 数据来自 NgRx 单一状态，任何页面看到的批次号、修订号、阻断原因一致。
 */
@Component({
  selector: 'app-revision-banner',
  standalone: true,
  imports: [CommonModule, TagModule, ButtonModule],
  template: `
    <section class="rev-banner" *ngIf="state">
      <div class="rev-row">
        <div class="rev-id">
          <span class="rev-label">当前换版批次</span>
          <b>{{ state.revision.batchId }}</b>
          <p-tag [value]="'图版 ' + state.revision.version" [severity]="state.revision.version === 'B' ? 'warn' : 'info'" />
          <p-tag [value]="state.revision.status" [severity]="state.revision.status === '已锁定' ? 'success' : 'secondary'" />
        </div>
        <div class="rev-meta">
          <span>图纸号 <b>{{ state.revision.drawingNo }}</b></span>
          <span>批次修订 <b>rev.{{ state.revision.revision }}</b></span>
          <span>{{ state.revision.releasedBy }} · {{ state.revision.releasedAt }}</span>
        </div>
      </div>
      <div class="rev-row rev-naming">
        <span><i class="pi pi-tag"></i>节点命名：{{ state.revision.nodeNaming }}</span>
        <span><i class="pi pi-map-marker"></i>允许施工区：</span>
        <p-tag *ngFor="let zone of state.revision.allowedZones" [value]="zone" severity="secondary" />
      </div>

      <div class="blockers" *ngIf="blockingReasons.length">
        <div class="blocker" *ngFor="let reason of blockingReasons">
          <i class="pi pi-exclamation-triangle"></i><span>{{ reason }}</span>
        </div>
      </div>

      <div class="conflict" *ngIf="state.conflict">
        <div class="conflict-head"><i class="pi pi-exclamation-circle"></i><b>换版并发冲突 —— 先到的换版结果已生效</b></div>
        <p>{{ state.conflict.reason }}</p>
        <div class="conflict-changes">
          <span>{{ state.conflict.submittedBy }} 保留的改动：</span>
          <code>节点命名：{{ state.conflict.theirNodeNaming }}</code>
          <code>允许施工区：{{ state.conflict.theirAllowedZones.join('、') }}</code>
        </div>
        <div class="conflict-actions">
          <p-button label="接受先到结果" size="small" (onClick)="accept()" />
          <p-button label="保留异议改动" size="small" severity="secondary" (onClick)="keep()" />
        </div>
      </div>

      <div class="kept" *ngIf="state.keptObjections.length">
        <i class="pi pi-flag"></i>已保留 {{ state.keptObjections.length }} 份对先到换版结果的异议改动
      </div>
    </section>
  `,
  styles: [
    `.rev-banner{background:#fff;border:1px solid #e1e7ef;border-left:4px solid #2563eb;border-radius:8px;padding:12px 16px;margin-bottom:16px;box-shadow:0 1px 3px #1018280a}`,
    `.rev-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px}`,
    `.rev-id{display:flex;align-items:center;gap:8px}`,
    `.rev-label{font-size:11px;color:#7a8798;letter-spacing:1px}`,
    `.rev-meta{display:flex;gap:14px;color:#667085;font-size:13px;margin-left:auto}`,
    `.rev-meta b{color:#182230}`,
    `.rev-naming{margin-top:6px;color:#475467;font-size:13px;gap:8px}`,
    `.rev-naming i{color:#2563eb;margin-right:2px}`,
    `.blockers{margin-top:10px;display:grid;gap:6px}`,
    `.blocker{display:flex;gap:8px;align-items:flex-start;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:7px 10px;font-size:13px;color:#92400e}`,
    `.blocker i{color:#d97706;margin-top:2px}`,
    `.conflict{margin-top:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 12px}`,
    `.conflict-head{display:flex;gap:8px;align-items:center;color:#b91c1c;font-size:14px}`,
    `.conflict p{margin:6px 0 0;font-size:13px;color:#7f1d1d}`,
    `.conflict-changes{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;font-size:13px;color:#7f1d1d}`,
    `.conflict-changes code{background:#fff;border:1px solid #fecaca;border-radius:4px;padding:2px 7px;font-size:12px}`,
    `.conflict-actions{display:flex;gap:8px;margin-top:10px}`,
    `.kept{margin-top:8px;font-size:12px;color:#6b7280}`,
    `@media(max-width:760px){.rev-meta{margin-left:0;width:100%}}`,
  ],
})
export class RevisionBannerComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState

  constructor() {
    this.store.select('welds').subscribe((state) => (this.state = state))
  }

  get pendingWelds(): Weld[] {
    return this.state?.welds.filter((w) => w.mappingStatus === '待映射') ?? []
  }

  get blockingReasons(): string[] {
    if (!this.state) return []
    const reasons: string[] = []
    const pending = this.pendingWelds
    if (pending.length) {
      reasons.push(`${pending.length} 条焊缝在 B 版节点命名中无新节点，已回填「待映射」（${pending.map((w) => w.id).join('、')}），不得列入检测计划`)
    }
    const blockedPlans = this.state.plans.filter((p) => p.blocked && p.state !== '已完成')
    if (blockedPlans.length) {
      reasons.push(`${blockedPlans.length} 个未完工计划已随图纸版本重算并阻断（${blockedPlans.map((p) => p.id).join('、')}）：节点未映射，计划暂停执行`)
    }
    if (this.state.writeState === 'writing') reasons.push('检测计划正在写入服务端…')
    if (this.state.writeState === 'recovered' && this.state.lastWriteError) {
      reasons.push(`计划写入失败，已从 ${this.state.confirmedPlans.length} 条已确认条目恢复：${this.state.lastWriteError}`)
    }
    return reasons
  }

  accept() {
    this.store.dispatch(A.clearConflict({ kept: false }))
  }
  keep() {
    this.store.dispatch(A.clearConflict({ kept: true }))
  }
}
