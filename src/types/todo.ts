export interface TodoItem {
  id: string;
  title: string;
  content: string;
  /** UTC ISO timestamp, or null when no deadline is set. */
  deadline: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TodoEdit = Pick<TodoItem, 'title' | 'content' | 'deadline'>;

export type ViewMode = 'collapsed' | 'expanded';
