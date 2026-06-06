export interface Scenario {
  id: number
  name: string
  description: string | null
  icon: string | null
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  duration_minutes: number | null
  category: string | null
  tags: string[]
  is_active: boolean
  created_at: string
}

export interface ScenarioListResponse {
  scenarios: Scenario[]
  total: number
}
