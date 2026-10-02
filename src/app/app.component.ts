import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { TagModule } from 'primeng/tag'
import { Store } from '@ngrx/store'
import { CommonModule } from '@angular/common'
import { WeldState } from './store/weld.reducer'
import { WeldGraphqlService } from './services/weld-graphql.service'
import * as A from './store/weld.actions'

@Component({
  selector:'app-root', standalone:true, imports:[CommonModule,RouterOutlet,RouterLink,RouterLinkActive,TagModule],
  template:`
    <header class="topbar">
      <div class="brand"><span>焊</span><div><b>钢结构焊缝质量平台</b><small>WELD & NDT CONTROL</small></div></div>
      <nav><a routerLink="/overview" routerLinkActive="active">台账总览</a><a routerLink="/map" routerLinkActive="active">构件定位</a><a routerLink="/inspections" routerLinkActive="active">检测返修</a><a routerLink="/approvals" routerLinkActive="active">审核锁定</a></nav>
      <span class="spacer"></span>
      <div class="ctx" *ngIf="activeBatch">
        <small>当前换版批次</small>
        <b>{{activeBatch.label}}</b>
        <p-tag [value]="activeBatch.status" [severity]="activeBatch.status === '已锁定' ? 'success' : activeBatch.status === '已生效' ? 'info' : 'warn'" />
      </div>
      <p-tag value="项目：东海会展中心" severity="success" />
    </header>
    <router-outlet />
  `,
  styles:[`
    .topbar{height:68px;background:#0f172a;color:#fff;display:flex;align-items:center;gap:14px;padding:0 22px;position:sticky;top:0;z-index:50}.brand{display:flex;gap:10px;align-items:center;min-width:220px}.brand>span{display:grid;place-items:center;width:36px;height:36px;border-radius:7px;background:#2563eb;font-weight:900}.brand b,.brand small{display:block}.brand small{font-size:9px;color:#8290a7;letter-spacing:1px}nav{display:flex;gap:3px}nav a{color:#cbd5e1;text-decoration:none;padding:10px 12px;border-radius:6px;font-size:14px}nav a.active{background:#1e293b;color:#fff}.spacer{flex:1}.ctx{text-align:right;line-height:1.25;margin-right:8px}.ctx small{display:block;color:#8290a7;font-size:10px}.ctx b{display:block;font-size:12.5px;margin:2px 0}
    @media(max-width:950px){.topbar{height:auto;min-height:64px;padding:10px;flex-wrap:wrap}.brand{min-width:180px}nav{order:4;width:100%;overflow:auto}.topbar>p-tag{display:none}.ctx{display:none}}
  `],
})
export class AppComponent {
  private readonly store = inject(Store<{ welds: WeldState }>)
  private readonly api = inject(WeldGraphqlService)
  state!: WeldState
  constructor() {
    this.store.select('welds').subscribe((state) => (this.state = state))
    this.api.load().subscribe((data) => this.store.dispatch(A.loadWeldsSuccess(data)))
  }
  get activeBatch() { return this.state?.batches.find((b) => b.id === this.state.activeBatchId) }
}
