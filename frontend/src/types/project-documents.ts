export interface ProjectDocument {
  id: string
  project_id: string
  user_id: string
  document_type: 'action-plan' | 'skill-test' | 'custom-training' | 'business-plan'
  title: string
  content: string
  prompt_used?: string
  context_added?: string
  metadata?: {
    secteur?: string
    budget?: string
    [key: string]: any
  }
  created_at: string
  updated_at: string
}

export interface DocumentCardProps {
  document: ProjectDocument
  onClick: () => void
}

export interface DocumentModalProps {
  document: ProjectDocument
  project: any
  onClose: () => void
  onAddContext: (context: string) => Promise<void>
}

export interface ContextFormProps {
  notes: any[]
  onSubmit: (context: string) => void
  onCancel: () => void
}
