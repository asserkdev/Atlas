export interface Folder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  description: string | null
  created_at: string
  updated_at: string
  notes?: Note[]
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  project_id: string | null
  folder_id: string | null
  title: string
  content: string
  starred: boolean
  word_count: number
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface NoteTemplate {
  id: string
  name: string
  description: string
  icon: string
  content: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high'
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: string
  user_id: string
  url: string
  title: string | null
  description: string | null
  favicon: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  created_at: string
}

export type ViewType = 'all' | 'folder' | 'project'

export interface NavigationItem {
  id: string
  type: ViewType
  name: string
  icon: string
  parentId?: string | null
}
