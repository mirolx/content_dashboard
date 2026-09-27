import { tableData } from '@/lib/tableData'
import type { ChecklistItem } from '@/lib/types'

export const checklistData = tableData<ChecklistItem>('checklist_items')
