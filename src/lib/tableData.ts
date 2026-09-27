import { createClient } from '@/lib/supabase/client'
import type { Row } from '@/lib/realtime/applyChange'
import type { WorkspaceTable } from '@/lib/types'

/** 위젯 테이블 하나에 대한 브라우저 쓰기 함수. 권한은 RLS가 확인한다. */
export function tableData<T extends Row>(table: WorkspaceTable) {
  const from = () => createClient().from(table)
  return {
    insert: (row: T) => from().insert(row),
    // supabase-js infers Update as the untyped client's `never`, so a generic
    // Partial<T> patch needs a cast here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (id: string, patch: Partial<T>) => from().update(patch as any).eq('id', id),
    remove: (id: string) => from().delete().eq('id', id),
  }
}
