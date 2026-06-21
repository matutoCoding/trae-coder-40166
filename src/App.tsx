import { useEffect, useState } from 'react'
import ImportWindow from './pages/ImportWindow'
import DiarizationWindow from './pages/DiarizationWindow'
import ReviewWindow from './pages/ReviewWindow'
import { useProjectStore } from './store/projectStore'

function App() {
  const [route, setRoute] = useState<string>('import')
  const loadMockData = useProjectStore(state => state.loadMockData)

  useEffect(() => {
    const hash = window.location.hash.replace('#/', '') || 'import'
    setRoute(hash)

    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#/', '') || 'import'
      setRoute(newHash)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const state = window.electronAPI?.getState()
    if (state?.store) {
      // Hydrate store from IPC state if available
    }
  }, [])

  const renderPage = () => {
    switch (route) {
      case 'import':
        return <ImportWindow />
      case 'diarization':
        return <DiarizationWindow />
      case 'review':
        return <ReviewWindow />
      default:
        return <ImportWindow />
    }
  }

  return (
    <div className="app-root">
      {renderPage()}
      <button
        onClick={() => loadMockData()}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          padding: '8px 16px',
          background: '#e5e7eb',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          color: '#374151',
          zIndex: 9999
        }}
      >
        加载演示数据
      </button>
    </div>
  )
}

export default App
