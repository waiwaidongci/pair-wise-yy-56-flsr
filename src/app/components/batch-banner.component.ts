import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Store } from '@ngrx/store'
import { ButtonModule } from 'primeng/button'
import { TagModule } from 'primeng/tag'
import { WeldState } from '../store/weld.reducer'
import { batchRevisions, selectBatchView } from '../store/weld.selectors'
import * as A from '../store/weld.actions'
import type { RevisionDraft } from '../types'

@Component({
  selector: 'app-batch-banner',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule],
  template: `
  <section class="card batch-card">
    <div class="batch-top">
      <div class="tabs">
        <button *ngFor="let b of state.batches" type="button" class="tab" [class.active]="b.id === state.viewingBatchId" (click)="switchBatch(b.id)">
          <span class="dot" [class.locked]="b.status === '已锁定'" [class.eff]="b.status === '已生效'"></span>
          {{b.label}}
          <p-tag [value]="b.status" [severity]="b.status === '已锁定' ? 'success' : b.status === '已生效' ? 'info' : 'warn'" styleClass="ml-1" />
        </button>
        <ng-container *ngFor="let d of state.drafts">
          <button type="button" class="tab draft" [class.conflicted]="!!d.conflict" [class.adopted]="d.status === '已采纳'"
                  (click)="submit(d)">
            <span class="pi" [class.pi-check-circle]="d.status === '已采纳'" [class.pi-exclamation-triangle]="d.conflict" [class.pi-send]="!d.conflict && d.status !== '已采纳'"></span>
            {{d.label}}
            <p-tag *ngIf="d.conflict" value="冲突保留" severity="danger" styleClass="ml-1" />
            <p-tag *ngIf="d.status === '已采纳'" value="已采纳生效" severity="success" styleClass="ml-1" />
            <p-tag *ngIf="!d.conflict && d.status !== '已采纳'" value="待提交" severity="warn" styleClass="ml-1" />
          </button>
        </ng-container>
      </div>
      <div class="batch-meta">
        <div><small>固定图纸号</small><b>{{view.batch.drawingNo}}</b><span>图号不随版次改</span></div>
        <div><small>发版 / 生效</small><b>{{view.batch.publishedAt}}</b><span>{{view.batch.effectiveAt ?? '尚未生效'}}</span></div>
        <div><small>确认人</small><b>{{view.batch.confirmedBy ?? '—'}}</b><span *ngIf="view.snapshot">快照 {{view.snapshot.lockedAt}} · {{view.snapshot.lockedBy}}</span></div>
      </div>
    </div>

    <p class="snapshot-note" *ngIf="view.snapshot">
      <span class="pi pi-lock"></span>正在按原快照只读查看「{{view.batch.label}}」：节点命名、焊缝台账与检测计划均为锁定时点数据，后续换版不改变此视图。
    </p>

    <div class="freeze-row">
      <div class="freeze"><b>节点命名（发版冻结）</b>
        <div class="chips">
          <span class="chip" *ngFor="let n of view.batch.nodes" [class.paused]="n.state === '暂停'">
            {{n.name}}<small *ngIf="n.renamedFrom"> ← {{n.renamedFrom}}</small><i>{{n.zone}} · {{n.state}}</i>
          </span>
        </div>
      </div>
      <div class="freeze"><b>允许施工区（发版固定）</b>
        <div class="chips">
          <span class="chip zone" *ngFor="let z of zoneRows" [class.paused]="z.state === '暂停'">{{z.zone}}<i>{{z.state}}</i></span>
        </div>
      </div>
    </div>

    <div class="rev-grid">
      <div class="rev-col">
        <h4><span class="pi pi-sitemap"></span> 同批修订（{{view.batch.revisionItems.length}}）</h4>
        <div class="rev" *ngFor="let r of revisions" [class.has-block]="r.blocks.length">
          <div class="rev-head"><p-tag [value]="r.item.type" severity="secondary" /><b>{{r.item.title}}</b></div>
          <p>{{r.item.detail}}</p>
          <div class="block-link" *ngFor="let blk of r.blocks">
            <span class="pi pi-ban"></span>{{blk.message}}
            <button type="button" class="link" *ngIf="view.isActive && blk.severity === '阻断'" (click)="resolve(blk.id)">现场已处理，重算 →</button>
          </div>
        </div>
      </div>
      <div class="rev-col">
        <h4><span class="pi pi-shield"></span> 阻断原因（{{blocking.length}} 阻断 / {{warnings.length}} 预警）</h4>
        <p class="empty" *ngIf="!view.blocks.length">本批次暂无阻断与预警，可在审核页签字锁定。</p>
        <div class="blk" *ngFor="let blk of view.blocks" [class.warn]="blk.severity === '预警'">
          <span class="tag">{{blk.severity}}</span>
          <div><b>{{blk.code}}</b><p>{{blk.message}}</p></div>
          <p-button *ngIf="view.isActive && blk.severity === '阻断'" label="处理并重算" size="small" severity="danger" [text]="true" (onClick)="resolve(blk.id)" />
        </div>
        <ng-container *ngIf="activeConflict">
          <h4 class="mt"><span class="pi pi-flag-fill"></span> 并发换版冲突（改动已保留）</h4>
          <div class="conflict">
            <b>{{activeConflict.reason}}</b>
            <p>{{activeConflict.changes}}</p>
            <small>先到先得：{{activeConflict.winnerBy}} 的 {{activeConflict.winnerBatchId}} 已生效；您的草稿不会被覆盖，可在差异基础上发起下一版（C 版）。</small>
          </div>
        </ng-container>
      </div>
    </div>
  </section>
  `,
  styles: [`
    .batch-card{margin-bottom:16px;border-left:4px solid #2563eb}
    .batch-top{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
    .tabs{display:flex;gap:8px;flex-wrap:wrap}
    .tab{display:inline-flex;align-items:center;gap:5px;border:1px solid #d6deea;background:#f8fafc;border-radius:7px;padding:7px 11px;font-size:13px;cursor:pointer;color:#334155}
    .tab .dot{width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block}
    .tab .dot.locked{background:#16a34a}.tab .dot.eff{background:#2563eb}
    .tab.active{border-color:#2563eb;background:#eff5ff;font-weight:700}
    .tab.draft{border-style:dashed}.tab.draft.conflicted{border-color:#dc2626;background:#fef2f2}.tab.draft.adopted{border-color:#16a34a;background:#f0fdf4}
    .tab .pi{font-size:13px}.tab .pi-exclamation-triangle{color:#dc2626}.tab .pi-check-circle{color:#16a34a}
    .ml-1{margin-left:3px}
    .batch-meta{display:flex;gap:22px}.batch-meta small,.batch-meta b,.batch-meta span{display:block}.batch-meta small{color:#7a8798;font-size:11px}.batch-meta b{font-size:14px;margin:2px 0}.batch-meta span{color:#667085;font-size:12px}
    .snapshot-note{display:flex;gap:8px;align-items:center;margin:12px 0 0;padding:9px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#15803d;font-size:13px}
    .freeze-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
    .freeze b{font-size:13px;color:#475569}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .chip{display:inline-flex;align-items:baseline;gap:6px;border:1px solid #cbd5e1;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:700;background:#fff}
    .chip small{font-weight:400;color:#64748b}.chip i{font-style:normal;font-size:11px;color:#16a34a;font-weight:400}.chip.paused{border-color:#fca5a5;background:#fef2f2}.chip.paused i{color:#dc2626}
    .rev-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.rev-col h4{margin:0 0 10px;font-size:14px;color:#334155;display:flex;gap:6px;align-items:center}.rev-col h4.mt{margin-top:16px}
    .rev{border:1px solid #e1e7ef;border-radius:7px;padding:10px 12px;margin-bottom:9px;background:#fbfdff}.rev.has-block{border-color:#fca5a5;background:#fffdfd}
    .rev-head{display:flex;gap:8px;align-items:center}.rev-head b{font-size:13.5px}.rev p{margin:6px 0 0;font-size:12.5px;line-height:1.55;color:#526071}
    .block-link{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:12.5px;color:#b91c1c;background:#fef2f2;border-radius:5px;padding:6px 9px;flex-wrap:wrap}.link{border:0;background:none;color:#2563eb;text-decoration:underline;cursor:pointer;font-size:12px}
    .empty{font-size:13px;color:#7a8798;background:#f8fafc;border-radius:6px;padding:10px}
    .blk{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;border:1px solid #fecaca;background:#fef2f2;border-radius:7px;padding:8px 11px;margin-bottom:8px}
    .blk.warn{border-color:#fde68a;background:#fffbeb}.blk.warn .tag{background:#f59e0b}.blk .tag{background:#dc2626;color:#fff;border-radius:4px;font-size:11px;padding:2px 7px}
    .blk b{font-size:12.5px}.blk p{margin:2px 0 0;font-size:12.5px;color:#526071;line-height:1.45}
    .conflict{border:1px solid #fca5a5;background:#fff;border-left:4px solid #dc2626;border-radius:6px;padding:11px}.conflict b{font-size:13px;color:#b91c1c}.conflict p{margin:6px 0;font-size:13px}.conflict small{color:#667085;font-size:12px;line-height:1.5}
    @media(max-width:1100px){.freeze-row,.rev-grid{grid-template-columns:1fr}.batch-meta{gap:14px}}
  `],
})
export class BatchBannerComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  state!: WeldState

  constructor() {
    this.store.select('welds').subscribe((state) => (this.state = state))
  }

  get view() {
    return selectBatchView(this.state)
  }
  get revisions() {
    return batchRevisions(this.view)
  }
  get zoneRows() {
    return Object.entries(this.view.batch.zones).map(([zone, state]) => ({ zone, state }))
  }
  get blocking() {
    return this.view.blocks.filter((b) => b.severity === '阻断')
  }
  get warnings() {
    return this.view.blocks.filter((b) => b.severity === '预警')
  }
  get activeConflict() {
    return this.state.drafts.find((d) => d.status === '保留' && d.conflict)?.conflict
  }

  switchBatch(batchId: string) {
    this.store.dispatch(A.viewBatch({ batchId }))
  }
  resolve(id: string) {
    this.store.dispatch(A.resolveBlock({ id }))
  }
  submit(draft: RevisionDraft) {
    if (draft.status === '已采纳' || draft.conflict) return
    this.store.dispatch(A.submitRevision({ draftId: draft.id, batch: draft.batch, mapping: draft.mapping }))
  }
}
