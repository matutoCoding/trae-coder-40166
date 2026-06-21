import { useEffect, useState, useRef } from 'react'
import ImportWindow from './pages/ImportWindow'
import DiarizationWindow from './pages/DiarizationWindow'
import ReviewWindow from './pages/ReviewWindow'
import { useProjectStore } from './store/projectStore'
import type { ProjectState } from '@shared/types'

function App() {
  const [route, setRoute] = useState<string>('import')
  const hydrateFromShared = useProjectStore(state => state.hydrateFromShared)
  const loadMockData = useProjectStore(state => state.loadMockData)
  const setHydratingFlag = useProjectStore(state => state.setHydratingFlag)
  const hydrateTimeoutRef = useRef<number | null>(null)

  const applyState = (projectState: Partial<ProjectState>) => {
    setHydratingFlag(true)
    hydrateFromShared(projectState)
    if (hydrateTimeoutRef.current) {
      clearTimeout(hydrateTimeoutRef.current)
    }
    hydrateTimeoutRef.current = window.setTimeout(() => {
      setHydratingFlag(false)
      hydrateTimeoutRef.current = null
    }, 150)
  }

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
    if (typeof window === 'undefined' || !window.electronAPI) return

    const existingState = window.electronAPI.getState()
    if (existingState && existingState.project) {
      applyState(existingState.project as Partial<ProjectState>)
    }

    const cleanup = window.electronAPI.onStateUpdated((state) => {
      if (state && state.project) {
        const currentStore = useProjectStore.getState()
        const incoming = state.project as ProjectState
        const currentSig = JSON.stringify({
          ci: currentStore.caseInfo,
          sp: currentStore.speakers,
          sg: currentStore.segments,
          rf: currentStore.recordingFile,
          au: currentStore.audioUrl,
          cs: currentStore.currentStep
        })
        const incomingSig = JSON.stringify({
          ci: incoming.caseInfo,
          sp: incoming.speakers,
          sg: incoming.segments,
          rf: incoming.recordingFile,
          au: incoming.audioUrl,
          cs: incoming.currentStep
        })
        if (currentSig !== incomingSig) {
          applyState(state.project as Partial<ProjectState>)
        }
      }
    })

    return () => {
      cleanup()
      if (hydrateTimeoutRef.current) {
        clearTimeout(hydrateTimeoutRef.current)
      }
    }
  }, [hydrateFromShared, setHydratingFlag])

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
