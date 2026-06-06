import type { Scenario } from '../../types/scenario'

interface ScenarioCardProps {
  scenario: Scenario
  onSelect: () => void
}

const difficultyConfig = {
  beginner:       { label: '入门', bg: 'bg-green-100',  text: 'text-green-700' },
  intermediate:   { label: '中级', bg: 'bg-orange-100', text: 'text-orange-700' },
  advanced:       { label: '高级', bg: 'bg-red-100',    text: 'text-red-700' },
} as const

export const ScenarioCard = ({ scenario, onSelect }: ScenarioCardProps) => {
  const diff = difficultyConfig[scenario.difficulty_level] ?? difficultyConfig.intermediate

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      role="button"
      tabIndex={0}
      className="group bg-white rounded-xl border border-gray-200 p-6 cursor-pointer
                 transition-all hover:border-blue-300 hover:shadow-lg hover:-translate-y-1
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      {/* 图标 */}
      <div className="w-12 h-12 flex items-center justify-center text-2xl
                      bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full mb-4
                      group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
        {scenario.icon || '📖'}
      </div>

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-blue-700 transition-colors">
        {scenario.name}
      </h3>

      {/* 描述 */}
      <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5rem]">
        {scenario.description || '暂无描述'}
      </p>

      {/* 标签区 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${diff.bg} ${diff.text}`}>
          {diff.label}
        </span>

        {scenario.duration_minutes != null && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {scenario.duration_minutes} 分钟
          </span>
        )}

        {scenario.category && (
          <span className="text-xs text-gray-300 ml-auto">{scenario.category}</span>
        )}
      </div>
    </div>
  )
}
