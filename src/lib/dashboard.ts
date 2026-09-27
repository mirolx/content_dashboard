import { requireUser } from '@/lib/auth/requireUser'
import { createClient } from '@/lib/supabase/server'
import type {
  ChecklistItem,
  Hashtag,
  KanbanCard,
  PinnedIdea,
  ReferenceItem,
  ScheduleItem,
  WorkspaceTable,
} from '@/lib/types'

export type DashboardData = {
  schedule: ScheduleItem[]
  checklist: ChecklistItem[]
  kanban: KanbanCard[]
  ideas: PinnedIdea[]
  references: ReferenceItem[]
  hashtags: Hashtag[]
}

export async function loadDashboard(workspaceId: string): Promise<DashboardData> {
  await requireUser()
  const supabase = await createClient()

  async function list<T>(table: WorkspaceTable): Promise<T[]> {
    const { data, error } = await supabase.from(table).select('*').eq('workspace_id', workspaceId)
    if (error) throw new Error(`${table}: ${error.message}`)
    return (data ?? []) as T[]
  }

  const [schedule, checklist, kanban, ideas, references, hashtags] = await Promise.all([
    list<ScheduleItem>('schedule_items'),
    list<ChecklistItem>('checklist_items'),
    list<KanbanCard>('kanban_cards'),
    list<PinnedIdea>('pinned_ideas'),
    list<ReferenceItem>('reference_items'),
    list<Hashtag>('hashtags'),
  ])
  return { schedule, checklist, kanban, ideas, references, hashtags }
}
