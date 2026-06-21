import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play, Square, ArrowLeft, Download, FileText,
  StickyNote, AlertTriangle, Check, X, MessageSquare,
  Scale, FileSignature, BookOpen, ChevronUp, ChevronDown,
  SkipForward, Layers
} from 'lucide-react'
import { useProjectStore } from '../store/projectStore'
import type { NoteType } from '@shared/types'
import { SPEAKER_ROLE_LABELS, NOTE_TYPE_LABELS, NOTE_TYPE_COLORS, RECORDING_TYPE_LABELS } from '@shared/types'
import { formatTime, formatTimeHMS, formatFileSize } from '@shared/utils'
import { exportRecordPackage } from '../utils/export'

const noteTypeIcons: Record<NoteType, typeof StickyNote> = {
  key_commitment: FileSignature,
  factual_statement: Check,
  disputed: Scale,
  warning: AlertTriangle,
  info: StickyNote
}

export default function ReviewWindow() {
  const {
    caseInfo, recordingFile, speakers, segments, audioUrl, setCurrentStep,
    addSegmentNote, removeSegmentNote, toggleSegmentReview
  } = useProjectStore()

  const [activeNoteSegment, setActiveNoteSegment] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('info')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [filterNoteType, setFilterNoteType] = useState<NoteType | null>(null)
  const [filterSpeaker, setFilterSpeaker] = useState<string | null>(null)
  const [showNeedReviewOnly, setShowNeedReviewOnly] = useState(false)
  const [showOverlapOnly, setShowOverlapOnly] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [reviewMode, setReviewMode] = useState<'all' | 'needReview' | 'overlap' | NoteType>('all')
  const [reviewIndex, setReviewIndex] = useState(0)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playEndTimeRef = useRef<number | null>(null)
  const playEndTimeoutRef = useRef<number | null>(null)
  const timeupdateHandlerRef = useRef<(() => void) | null>(null)
  const pendingStartRef = useRef<{ segmentId: string; startTime: number; endTime: number } | null>(null)

  const stopPlayback = () => {
    if (playEndTimeoutRef.current) {
      clearTimeout(playEndTimeoutRef.current)
      playEndTimeoutRef.current = null
    }
    if (timeupdateHandlerRef.current && audioRef.current) {
      audioRef.current.removeEventListener('timeupdate', timeupdateHandlerRef.current)
      timeupdateHandlerRef.current = null
    }
    playEndTimeRef.current = null
    pendingStartRef.current = null
    if (audioRef.current) {
      try { audioRef.current.pause() } catch {}
    }
    setPlayingId(null)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    return () => { stopPlayback() }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    if (audio.src !== audioUrl) {
      audio.src = audioUrl
      audio.load()
    }
  }, [audioUrl])

  const getSpeakerById = (id: string) => speakers.find(s => s.id === id)

  const totalDuration = segments.length > 0
    ? Math.max(...segments.map(s => s.endTime))
    : 0

  const filteredSegments = segments.filter(seg => {
    if (filterSpeaker && seg.speakerId !== filterSpeaker) return false
    if (reviewMode === 'needReview') return seg.needsReview
    if (reviewMode === 'overlap') return seg.isOverlapping
    if (reviewMode !== 'all' && seg.noteType !== reviewMode) return false
    return true
  })

  const navigateToSegment = useCallback((direction: 'prev' | 'next') => {
    if (filteredSegments.length === 0) return
    let newIndex = direction === 'next' ? reviewIndex + 1 : reviewIndex - 1
    if (newIndex >= filteredSegments.length) newIndex = 0
    if (newIndex < 0) newIndex = filteredSegments.length - 1
    setReviewIndex(newIndex)
    const seg = filteredSegments[newIndex]
    if (seg) {
      const el = document.getElementById(`seg-${seg.id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [filteredSegments, reviewIndex])

  useEffect(() => {
    if (filteredSegments.length > 0 && reviewIndex >= filteredSegments.length) {
      setReviewIndex(0)
    }
  }, [filteredSegments.length, reviewIndex])

  const noteCounts = {
    key_commitment: segments.filter(s => s.noteType === 'key_commitment').length,
    factual_statement: segments.filter(s => s.noteType === 'factual_statement').length,
    disputed: segments.filter(s => s.noteType === 'disputed').length,
    warning: segments.filter(s => s.noteType === 'warning').length,
    info: segments.filter(s => s.noteType === 'info').length
  }

  const handlePlaySegment = (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId)
    if (!segment || !audioRef.current) return

    if (playingId === segmentId) {
      stopPlayback()
      return
    }

    stopPlayback()

    const audio = audioRef.current

    if (!audio.src && audioUrl) {
      audio.src = audioUrl
    } else if (audioUrl && audio.src !== audioUrl) {
      audio.src = audioUrl
    }

    setPlayingId(segmentId)
    playEndTimeRef.current = segment.endTime

    const doPlay = () => {
      try {
        audio.currentTime = segment.startTime
        const p = audio.play()
        if (p && typeof p.then === 'function') {
          p.catch(() => {})
        }
      } catch {
        // ignore
      }
    }

    const onTimeUpdate = () => {
      if (playEndTimeRef.current != null && audioRef.current) {
        if (audioRef.current.currentTime >= playEndTimeRef.current - 0.05) {
          stopPlayback()
        }
      }
    }

    const durationMs = (segment.endTime - segment.startTime) * 1000
    playEndTimeoutRef.current = window.setTimeout(() => {
      stopPlayback()
    }, Math.min(durationMs + 1000, 35000))

    timeupdateHandlerRef.current = onTimeUpdate
    audio.addEventListener('timeupdate', onTimeUpdate)

    if (audio.readyState >= 2) {
      doPlay()
    } else {
      pendingStartRef.current = { segmentId, startTime: segment.startTime, endTime: segment.endTime }
      const onLoaded = () => {
        if (pendingStartRef.current && pendingStartRef.current.segmentId === segmentId) {
          doPlay()
        }
      }
      audio.addEventListener('loadedmetadata', onLoaded, { once: true })
      audio.addEventListener('canplay', onLoaded, { once: true })
      if (!audio.src) {
        audio.load()
      }
    }
  }

  const handleSaveNote = (segmentId: string) => {
    if (noteText.trim()) {
      addSegmentNote(segmentId, noteText.trim(), noteType)
    }
    setActiveNoteSegment(null)
    setNoteText('')
    setNoteType('info')
  }

  const handleCancelNote = () => {
    setActiveNoteSegment(null)
    setNoteText('')
    setNoteType('info')
  }

  const handleBack = () => {
    setCurrentStep('diarization')
    window.electronAPI.openWindow('diarization')
  }

  const handleExport = async () => {
    if (!caseInfo || !recordingFile) {
      alert('案件信息不完整，请返回第一步完善')
      return
    }
    setIsExporting(true)
    try {
      await exportRecordPackage({ caseInfo, recordingFile, speakers, segments, totalDuration })
    } catch (e) {
      console.error(e)
      alert('导出失败：' + (e as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  const stats = {
    total: segments.length,
    withNotes: segments.filter(s => s.note).length,
    needReview: segments.filter(s => s.needsReview).length,
    overlapping: segments.filter(s => s.isOverlapping).length,
    disputed: noteCounts.disputed,
    keyCommitments: noteCounts.key_commitment
  }

  return (
    <div className="window-container">
      <header className="window-header">
        <div className="window-header-title">
          <h1>会议取证转写工具</h1>
          <span className="step-badge">第三步 · 审阅封存</span>
        </div>
        <div className="window-header-actions">
          {caseInfo && (
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              {caseInfo.caseNumber} · {caseInfo.caseName}
            </span>
          )}
        </div>
      </header>

      <div className="step-indicator">
        <div className="step-item completed">
          <div className="step-number">1</div>
          <span>录音导入</span>
        </div>
        <div className="step-divider"></div>
        <div className="step-item completed">
          <div className="step-number">2</div>
          <span>声纹分轨</span>
        </div>
        <div className="step-divider"></div>
        <div className="step-item active">
          <div className="step-number">3</div>
          <span>审阅封存</span>
        </div>
      </div>

      <div className="window-content" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '14px 24px',
          background: 'white',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MessageSquare size={14} /> 共 <strong style={{ color: 'var(--text)' }}>{stats.total}</strong> 条
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StickyNote size={14} /> 已备注 <strong style={{ color: 'var(--info)' }}>{stats.withNotes}</strong> 条
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={14} /> 待复听 <strong style={{ color: 'var(--warning)' }}>{stats.needReview}</strong> 条
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Scale size={14} /> 争议点 <strong style={{ color: 'var(--danger)' }}>{stats.disputed}</strong> 处
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileSignature size={14} /> 关键承诺 <strong style={{ color: 'var(--gold)' }}>{stats.keyCommitments}</strong> 处
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {reviewMode !== 'all' && filteredSegments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: '2px 4px', borderRadius: 4 }}>
                <button
                  onClick={() => navigateToSegment('prev')}
                  style={{ padding: '2px 6px', background: 'white', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronUp size={14} />
                </button>
                <span style={{ fontSize: 11, color: 'var(--text)', minWidth: 40, textAlign: 'center' }}>
                  {reviewIndex + 1}/{filteredSegments.length}
                </span>
                <button
                  onClick={() => navigateToSegment('next')}
                  style={{ padding: '2px 6px', background: 'white', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => navigateToSegment('next')}
                  style={{ padding: '2px 6px', background: 'white', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 2 }}
                  title="下一条并播放"
                >
                  <SkipForward size={14} />
                </button>
              </div>
            )}
            <select
              className="form-control"
              style={{ width: 140, padding: '5px 8px', fontSize: 12 }}
              value={filterSpeaker || ''}
              onChange={e => setFilterSpeaker(e.target.value || null)}
            >
              <option value="">全部发言人</option>
              {speakers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{
            width: 260,
            background: 'white',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto'
          }}>
            {caseInfo && (
              <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>案件名称</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{caseInfo.caseName}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>案件编号</span>
                  <span>{caseInfo.caseNumber || '-'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>录音类型</span>
                  <span>{RECORDING_TYPE_LABELS[caseInfo.recordingType]}</span>
                  <span style={{ color: 'var(--text-muted)' }}>会议日期</span>
                  <span>{caseInfo.date}</span>
                  <span style={{ color: 'var(--text-muted)' }}>会议地点</span>
                  <span style={{ wordBreak: 'break-all' }}>{caseInfo.location || '-'}</span>
                </div>
              </div>
            )}

            {recordingFile && (
              <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>录音文件</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, wordBreak: 'break-all' }}>
                  <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{recordingFile.name}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {formatFileSize(recordingFile.size)} · {formatTimeHMS(totalDuration || recordingFile.duration)}
                  </div>
                </div>
              </div>
            )}

            <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} />
                批量核对模式
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  className={reviewMode === 'all' ? 'step-item active' : 'step-item'}
                  style={{ justifyContent: 'flex-start', padding: '6px 10px' }}
                  onClick={() => { setReviewMode('all'); setReviewIndex(0) }}
                >
                  <BookOpen size={14} />
                  <span>全部内容</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{stats.total}</span>
                </button>
                <button
                  className={reviewMode === 'needReview' ? 'step-item active' : 'step-item'}
                  style={{ justifyContent: 'flex-start', padding: '6px 10px' }}
                  onClick={() => { setReviewMode('needReview'); setReviewIndex(0) }}
                >
                  <AlertTriangle size={14} style={{ color: '#d97706' }} />
                  <span>需人工复听</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#d97706', fontWeight: 600 }}>{stats.needReview}</span>
                </button>
                <button
                  className={reviewMode === 'overlap' ? 'step-item active' : 'step-item'}
                  style={{ justifyContent: 'flex-start', padding: '6px 10px' }}
                  onClick={() => { setReviewMode('overlap'); setReviewIndex(0) }}
                >
                  <Layers size={14} style={{ color: '#9a3412' }} />
                  <span>重叠发言</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9a3412', fontWeight: 600 }}>{stats.overlapping}</span>
                </button>
                {(Object.keys(NOTE_TYPE_LABELS) as NoteType[]).map(nt => {
                  const Icon = noteTypeIcons[nt]
                  return (
                    <button
                      key={nt}
                      className={reviewMode === nt ? 'step-item active' : 'step-item'}
                      style={{ justifyContent: 'flex-start', padding: '6px 10px' }}
                      onClick={() => { setReviewMode(nt); setReviewIndex(0) }}
                    >
                      <Icon size={14} />
                      <span>{NOTE_TYPE_LABELS[nt]}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{noteCounts[nt]}</span>
                    </button>
                  )
                })}
              </div>
              {reviewMode !== 'all' && filteredSegments.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, background: '#f0f9ff', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>核对导航</div>
                  <div>使用顶部 <ChevronUp size={10} /><ChevronDown size={10} /> 按钮逐条审阅</div>
                  <div>处理完按 <SkipForward size={10} /> 跳下一条</div>
                  <div style={{ marginTop: 4, color: '#2563eb', fontWeight: 500 }}>
                    当前：第 {reviewIndex + 1} 条 / 共 {filteredSegments.length} 条
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>参会人员</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {speakers.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无</div>
                ) : speakers.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }}></div>
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                    <span className={`badge badge-${s.role}`} style={{ marginLeft: 'auto' }}>
                      {SPEAKER_ROLE_LABELS[s.role]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
            {filteredSegments.length === 0 ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <FileText size={48} className="empty-state-icon" />
                <div className="empty-state-title">暂无匹配的转写内容</div>
                <div className="empty-state-desc">
                  请调整筛选条件，或先在「声纹分轨」中处理录音
                </div>
              </div>
            ) : (
              <div style={{ padding: 20, maxWidth: 960, margin: '0 auto' }}>
                {filteredSegments.map((segment, index) => {
                  const speaker = getSpeakerById(segment.speakerId)
                  const isPlaying = playingId === segment.id
                  const isAddingNote = activeNoteSegment === segment.id
                  const NoteIcon = segment.noteType ? noteTypeIcons[segment.noteType] : StickyNote

                  return (
                    <div
                      key={segment.id}
                      id={`seg-${segment.id}`}
                      style={{
                        background: 'white',
                        border: isPlaying ? '2px solid var(--primary-light)' : '1px solid var(--border)',
                        borderRadius: 8,
                        marginBottom: 12,
                        overflow: 'hidden',
                        boxShadow: isPlaying ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
                      }}
                    >
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-light)',
                        background: segment.needsReview ? '#fef2f2' : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap'
                      }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: speaker?.color || '#64748b',
                          color: 'white'
                        }}>
                          #{index + 1}
                        </span>
                        <span style={{ fontWeight: 600, color: speaker?.color || 'var(--text)' }}>
                          {speaker?.name || '未知发言人'}
                        </span>
                        {speaker && <span className={`badge badge-${speaker.role}`}>{SPEAKER_ROLE_LABELS[speaker.role]}</span>}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          ⏱ {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                        </span>

                        {segment.isOverlapping && <span className="badge badge-overlap"><AlertTriangle size={10} /> 重叠发言</span>}
                        {segment.needsReview && <span className="badge badge-review">需人工复听</span>}

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => handlePlaySegment(segment.id)}
                            disabled={!audioUrl}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '4px 10px',
                              borderRadius: 4,
                              fontSize: 12,
                              background: !audioUrl ? '#e2e8f0' : (isPlaying ? 'var(--primary)' : '#f1f5f9'),
                              color: !audioUrl ? '#94a3b8' : (isPlaying ? 'white' : 'var(--text)'),
                              fontWeight: 500,
                              cursor: !audioUrl ? 'not-allowed' : 'pointer',
                              opacity: !audioUrl ? 0.6 : 1
                            }}
                            title={!audioUrl ? '音频未就绪' : (isPlaying ? '暂停' : '播放')}
                          >
                            {isPlaying ? <Square size={12} /> : <Play size={12} />}
                            {isPlaying ? '暂停' : '播放'}
                          </button>
                          <button
                            onClick={() => toggleSegmentReview(segment.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '4px 10px',
                              borderRadius: 4,
                              fontSize: 12,
                              background: segment.needsReview ? '#fee2e2' : '#f1f5f9',
                              color: segment.needsReview ? '#b91c1c' : 'var(--text)',
                              fontWeight: 500
                            }}
                          >
                            <AlertTriangle size={12} />
                            {segment.needsReview ? '已标记' : '标记需复听'}
                          </button>
                        </div>
                      </div>

                      <div style={{ padding: '14px 16px' }}>
                        <div style={{
                          fontSize: 14,
                          lineHeight: 1.8,
                          color: segment.needsReview ? '#991b1b' : 'var(--text)',
                          fontFamily: '"Songti SC", "SimSun", serif'
                        }}>
                          「{segment.text}」
                        </div>
                      </div>

                      {segment.note && !isAddingNote && (
                        <div style={{
                          margin: '0 16px 14px',
                          padding: '10px 14px',
                          borderRadius: 6,
                          background: segment.noteType ? NOTE_TYPE_COLORS[segment.noteType] : '#f8fafc',
                          border: `1px solid ${segment.noteType ? 'transparent' : 'var(--border)'}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                              <NoteIcon size={13} />
                              {segment.noteType ? NOTE_TYPE_LABELS[segment.noteType] : '备注'}
                            </div>
                            <button
                              onClick={() => removeSegmentNote(segment.id)}
                              style={{ fontSize: 11, color: 'var(--text-muted)' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                            {segment.note}
                          </div>
                        </div>
                      )}

                      {isAddingNote ? (
                        <div style={{ margin: '0 16px 14px', padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                            {(Object.keys(NOTE_TYPE_LABELS) as NoteType[]).map(nt => {
                              const Icon = noteTypeIcons[nt]
                              return (
                                <button
                                  key={nt}
                                  onClick={() => setNoteType(nt)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '4px 10px',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    fontWeight: noteType === nt ? 600 : 400,
                                    background: noteType === nt ? NOTE_TYPE_COLORS[nt] : 'white',
                                    border: `1px solid ${noteType === nt ? 'transparent' : 'var(--border)'}`
                                  }}
                                >
                                  <Icon size={12} />
                                  {NOTE_TYPE_LABELS[nt]}
                                </button>
                              )
                            })}
                          </div>
                          <textarea
                            autoFocus
                            className="form-control"
                            placeholder={`输入"${NOTE_TYPE_LABELS[noteType]}"备注内容，不修改原话...`}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            rows={3}
                            style={{ marginBottom: 10 }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={handleCancelNote}>取消</button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSaveNote(segment.id)}
                              disabled={!noteText.trim()}
                            >
                              <Check size={12} /> 保存备注
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          padding: '8px 16px 14px',
                          borderTop: '1px solid var(--border-light)',
                          background: '#fafafa'
                        }}>
                          <button
                            onClick={() => {
                              setActiveNoteSegment(segment.id)
                              if (segment.note) {
                                setNoteText(segment.note)
                                setNoteType(segment.noteType || 'info')
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              color: segment.note ? 'var(--primary)' : 'var(--text-secondary)',
                              fontWeight: 500
                            }}
                          >
                            <StickyNote size={13} />
                            {segment.note ? '编辑备注' : '添加备注'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="window-footer">
        <button className="btn btn-secondary" onClick={handleBack}>
          <ArrowLeft size={14} /> 返回声纹分轨
        </button>
        <audio ref={audioRef} preload="auto" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-success btn-lg"
            onClick={handleExport}
            disabled={isExporting || !caseInfo || segments.length === 0}
          >
            <Download size={16} />
            {isExporting ? '正在导出...' : '导出会议记录包'}
          </button>
        </div>
      </div>
    </div>
  )
}
