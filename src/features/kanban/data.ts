import { tableData } from '@/lib/tableData'
import type { KanbanCard } from '@/lib/types'

export const kanbanData = tableData<KanbanCard>('kanban_cards')
