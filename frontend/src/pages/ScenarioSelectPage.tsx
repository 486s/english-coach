import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScenarioCard } from '../components/ScenarioSelector/ScenarioCard'
import type { Scenario } from '../types/scenario'

export const ScenarioSelectPage = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const controller = new AbortController()

    const fetchScenarios = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/scenarios/`,
          { signal: controller.signal }
        )
        if (!res.ok) throw new Error(`请求失败 (${res.status})`)
        const data = await res.json()
        setScenarios(data.scenarios ?? [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : '加载场景失败')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchScenarios()
    return () => controller.abort()
  }, [])

  // ── 加载态：骨架屏 ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">选择对话场景</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse border border-gray-200">
              <div className="w-12 h-12 bg-gray-200 rounded-full mb-4" />
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-full mb-3" />
              <div className="flex gap-2">
                <div className="h-4 bg-gray-100 rounded w-16" />
                <div className="h-4 bg-gray-100 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── 错误态 ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-red-200 max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-semibold text-red-700 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true) }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  // ── 空结果态 ──
  if (scenarios.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="text-gray-400 text-5xl mb-4">📭</div>
          <h2 className="text-xl font-semibold text-gray-600">暂无可选场景</h2>
          <p className="text-gray-400 mt-2">敬请期待更多场景上线</p>
        </div>
      </div>
    )
  }

  // ── 正常态 ──
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">选择对话场景</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {scenarios.map(s => (
          <ScenarioCard
            key={s.id}
            scenario={s}
            onSelect={() => navigate(`/chat/${s.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
