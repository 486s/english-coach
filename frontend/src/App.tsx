import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ScenarioSelectPage } from './pages/ScenarioSelectPage'
import { ChatPage } from './pages/ChatPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScenarioSelectPage />} />
        <Route path="/chat/:scenarioId" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App