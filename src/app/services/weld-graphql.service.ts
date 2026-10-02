import { inject, Injectable } from '@angular/core'
import { Apollo, gql } from 'apollo-angular'
import { map } from 'rxjs'
import type { Seed } from '../seed'

const WELD_FIELDS = `id drawing component joint node nodeA nodeB zone zoneState batchId mappingState mappingNote method welder qualification qualificationValid inspectionRatio requiredRatio status x y repairs defects { id position type length level method report }`
const PLAN_FIELDS = `id date method inspector state batchId recomputedFor writeState entries { weldId node zone valid flag blockCode blockReason writeState } confirmedEntries { weldId node zone valid flag blockCode blockReason writeState }`
const BATCH_FIELDS = `id fromBatchId label drawingNo scopeDrawings status publishedAt effectiveAt confirmedBy allowedZones zones nodes { name zone state renamedFrom } revisionItems { id type title detail impactWeldIds impactPlanIds relatedBlockCodes }`
const BLOCK_FIELDS = `id severity scope refId code message batchId`

const WELDS_QUERY = gql`
  query Welds {
    welds { ${WELD_FIELDS} }
    plans { ${PLAN_FIELDS} }
    batches { ${BATCH_FIELDS} }
    drafts { id label author basedOn createdAt status conflict { winnerBatchId winnerBy reason changes } batch { ${BATCH_FIELDS} } mapping { weldId fromNode toNode } }
    blocks { ${BLOCK_FIELDS} }
    snapshotList { batchId lockedAt lockedBy batch { ${BATCH_FIELDS} } welds { ${WELD_FIELDS} } plans { ${PLAN_FIELDS} } blocks { ${BLOCK_FIELDS} } }
    audit { id time actor action target detail }
  }
`

@Injectable({ providedIn: 'root' })
export class WeldGraphqlService {
  private readonly apollo = inject(Apollo)
  load() {
    return this.apollo.watchQuery<Seed>({ query: WELDS_QUERY, fetchPolicy: 'network-only' }).valueChanges.pipe(
      map((result) => {
        const data = result.data as unknown as Omit<Seed, 'snapshots'> & { snapshotList: Seed['snapshotList'] }
        const snapshots: Seed['snapshots'] = {}
        for (const s of data.snapshotList ?? []) snapshots[s.batchId] = s
        return { ...data, snapshots }
      }),
    )
  }
}
