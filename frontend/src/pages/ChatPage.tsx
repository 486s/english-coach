import { useParams, useNavigate } from 'react-router-dom'

export const ChatPage = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
        <div className="text-4xl mb-4">💬</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">对话页面</h1>
        <p className="text-gray-500 mb-2">场景 ID：{scenarioId}</p>
        <p className="text-gray-400 text-sm mb-6">（PR 1.3 实现完整对话功能）</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50
                     rounded-lg transition-colors"
        >
          ← 返回场景列表
        </button>
      </div>
    </div>
  )
}
