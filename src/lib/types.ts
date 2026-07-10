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

export interface Note {
  id: string
  user_id: string
  project_id: string | null
  folder_id: string | null
  title: string
  content: string
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
