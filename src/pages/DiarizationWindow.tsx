import { useState, useRef, useEffect } from 'react'
import {
  UserPlus, Pencil, Trash2, Play, Square, AlertTriangle,
  ArrowRight, ArrowLeft, Users, Clock, Volume2
} from 'lucide-react'
import { useProjectStore } from '../store/projectStore'
import type { SpeakerRole } from '@shared/types'
import { SPEAKER_ROLE_LABELS } from '@shared/types'
import { formatTime } from '@shared/utils'

export default function DiarizationWindow() {
  const {
    caseInfo, recordingFile, speakers, segments, audioUrl, setCurrentStep,
    addSpeaker, updateSpeaker, removeSpeaker, updateSegment, toggleSegmentReview
  } = useProjectStore()

  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [newSpeakerName, setNewSpeakerName] = useState('')
  const [newSpeakerRole, setNewSpeakerRole] = useState<SpeakerRole>('other')
  const [showAddSpeaker, setShowAddSpeaker] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedSpeakerFilter, setSelectedSpeakerFilter] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playEndTimeRef = useRef<number | null>(null)
  const playEndTimeoutRef = useRef<number | null>(null)
  const timeupdateHandlerRef = useRef<(() => void) | null>(null)
  const pendingStartRef = useRef<{ segmentId: string; startTime: number; endTime: number } | null>(null)

  const totalDuration = segments.length > 0
    ? Math.max(...segments.map(s => s.endTime))
    : (recordingFile?.duration || 300)

  const filteredSegments = selectedSpeakerFilter
    ? segments.filter(s => s.speakerId === selectedSpeakerFilter)
    : segments

  const getSpeakerById = (id: string) => speakers.find(s => s.id === id)

  const handleAddSpeaker = () => {
    if (!newSpeakerName.trim()) return
    addSpeaker(newSpeakerName.trim(), newSpeakerRole)
    setNewSpeakerName('')
    setNewSpeakerRole('other')
    setShowAddSpeaker(false)
  }

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
        setCurrentTime(segment.startTime)
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

  const handleBack = () => {
    setCurrentStep('import')
    window.electronAPI.openWindow('import')
  }

  const handleNext = () => {
    if (speakers.length === 0) {
      alert('请至少添加一位发言人')
      return
    }
    setCurrentStep('review')
    window.electronAPI.openWindow('review')
  }

  const overlapSegments = segments.filter(s => s.isOverlapping)
  const needReviewSegments = segments.filter(s => s.needsReview)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    audio.addEventListener('timeupdate', updateTime)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      stopPlayback()
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    if (audio.src !== audioUrl) {
      audio.src = audioUrl
      audio.load()
    }
  }, [audioUrl])

  return (
    <div className="window-container">
      <header className="window-header">
        <div className="window-header-title">
          <h1>会议取证转写工具</h1>
          <span className="step-badge">第二步 · 声纹分轨</span>
        </div>
        <div className="window-header-actions">
          {caseInfo && (
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              {caseInfo.caseNumber || ''} {caseInfo.caseName}
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
        <div className="step-item active">
          <div className="step-number">2</div>
          <span>声纹分轨</span>
        </div>
        <div className="step-divider"></div>
        <div className="step-item">
          <div className="step-number">3</div>
          <span>审阅封存</span>
        </div>
      </div>

      <div className="window-content" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>已识别 {speakers.length} 位发言人</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>总时长 {formatTime(totalDuration)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Volume2 size={18} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>共 {segments.length} 条语音片段</span>
          </div>
          {audioUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#dcfce7', borderRadius: 4 }}>
              <Play size={14} style={{ color: '#166534' }} />
              <span style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>音频已就绪</span>
            </div>
          )}
          {overlapSegments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#ffedd5', borderRadius: 4 }}>
              <AlertTriangle size={14} style={{ color: '#9a3412' }} />
              <span style={{ fontSize: 12, color: '#9a3412', fontWeight: 500 }}>
                {overlapSegments.length} 处重叠发言，{needReviewSegments.length} 处需人工复听
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 280, background: 'white', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>发言人列表</div>
              {speakers.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <Users size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无发言人</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    className={selectedSpeakerFilter === null ? 'step-item active' : 'step-item'}
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={() => setSelectedSpeakerFilter(null)}
                  >
                    <div style={{
                      width: 12, height: 12, borderRadius: 3,
                      background: 'linear-gradient(135deg, #64748b, #475569)'
                    }}></div>
                    <span>全部发言人</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                      {segments.length}
                    </span>
                  </button>
                  {speakers.map(speaker => (
                    <div key={speaker.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className={selectedSpeakerFilter === speaker.id ? 'step-item active' : 'step-item'}
                        style={{ flex: 1, justifyContent: 'flex-start' }}
                        onClick={() => setSelectedSpeakerFilter(speaker.id)}
                      >
                        <div style={{
                          width: 12, height: 12, borderRadius: 3, background: speaker.color
                        }}></div>
                        {editingSpeaker === speaker.id ? (
                          <input
                            autoFocus
                            defaultValue={speaker.name}
                            onBlur={(e) => {
                              updateSpeaker(speaker.id, { name: e.target.value || speaker.name })
                              setEditingSpeaker(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateSpeaker(speaker.id, { name: (e.target as HTMLInputElement).value || speaker.name })
                                setEditingSpeaker(null)
                              }
                            }}
                            style={{
                              padding: '2px 6px',
                              border: '1px solid var(--primary-light)',
                              borderRadius: 4,
                              fontSize: 12,
                              width: 100
                            }}
                          />
                        ) : (
                          <span>{speaker.name}</span>
                        )}
                        <span className={`badge badge-${speaker.role}`} style={{ marginLeft: 'auto' }}>
                          {SPEAKER_ROLE_LABELS[speaker.role]}
                        </span>
                      </button>
                      {editingSpeaker !== speaker.id && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px' }}
                            onClick={() => setEditingSpeaker(speaker.id)}
                            title="编辑姓名"
                          >
                            <Pencil size={12} />
                          </button>
                          <select
                            value={speaker.role}
                            onChange={(e) => updateSpeaker(speaker.id, { role: e.target.value as SpeakerRole })}
                            style={{
                              fontSize: 11,
                              padding: '2px 4px',
                              border: '1px solid var(--border)',
                              borderRadius: 4
                            }}
                          >
                            {Object.entries(SPEAKER_ROLE_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', color: 'var(--danger)' }}
                            onClick={() => removeSpeaker(speaker.id)}
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showAddSpeaker ? (
                <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="姓名"
                      value={newSpeakerName}
                      onChange={e => setNewSpeakerName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <select
                      className="form-control"
                      value={newSpeakerRole}
                      onChange={e => setNewSpeakerRole(e.target.value as SpeakerRole)}
                    >
                      {Object.entries(SPEAKER_ROLE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleAddSpeaker}>确认添加</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAddSpeaker(false)}>取消</button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={() => setShowAddSpeaker(true)}
                >
                  <UserPlus size={14} />
                  添加发言人
                </button>
              )}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>图例说明</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-overlap"><AlertTriangle size={10} /> 重叠发言</span>
                  <span style={{ color: 'var(--text-muted)' }}>需逐一核对</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-review">需人工复听</span>
                  <span style={{ color: 'var(--text-muted)' }}>点击切换标记</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    播放时长 {formatTime(currentTime)} / {formatTime(totalDuration)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
            {filteredSegments.length === 0 ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <Volume2 size={48} className="empty-state-icon" />
                <div className="empty-state-title">暂无转写数据</div>
                <div className="empty-state-desc">
                  请先在「录音导入」中导入录音文件，系统将自动生成声纹分轨和转写
                </div>
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                {filteredSegments.map((segment, index) => {
                  const speaker = getSpeakerById(segment.speakerId)
                  const isPlaying = playingId === segment.id
                  const pctStart = (segment.startTime / totalDuration) * 100
                  const pctWidth = Math.max(((segment.endTime - segment.startTime) / totalDuration) * 100, 0.5)

                  return (
                    <div
                      key={segment.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        marginBottom: 10,
                        background: 'white',
                        border: isPlaying ? '2px solid var(--primary-light)' : '1px solid var(--border)',
                        borderRadius: 8,
                        boxShadow: isPlaying ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <button
                        onClick={() => handlePlaySegment(segment.id)}
                        disabled={!audioUrl}
                        style={{
                          width: 36, height: 36,
                          borderRadius: '50%',
                          background: !audioUrl ? '#94a3b8' : (speaker?.color || 'var(--primary)'),
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.2s',
                          cursor: !audioUrl ? 'not-allowed' : 'pointer',
                          opacity: !audioUrl ? 0.5 : 1
                        }}
                        title={!audioUrl ? '音频未就绪' : (isPlaying ? '暂停' : `播放 ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`)}
                      >
                        {isPlaying ? <Square size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: speaker?.color || 'var(--text)' }}>
                            {speaker?.name || '未知发言人'}
                          </span>
                          {speaker && <span className={`badge badge-${speaker.role}`}>{SPEAKER_ROLE_LABELS[speaker.role]}</span>}
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                          </span>
                          {segment.isOverlapping && <span className="badge badge-overlap"><AlertTriangle size={10} /> 重叠发言</span>}
                          {segment.needsReview && <span className="badge badge-review">需人工复听</span>}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            #{index + 1}
                          </span>
                        </div>

                        <div style={{
                          fontSize: 13.5,
                          lineHeight: 1.75,
                          color: segment.needsReview ? '#b91c1c' : 'var(--text)',
                          marginBottom: 8
                        }}>
                          {segment.text}
                        </div>

                        <div style={{
                          position: 'relative',
                          height: 4,
                          background: '#e5e7eb',
                          borderRadius: 2,
                          marginBottom: 8
                        }}>
                          <div
                            style={{
                              position: 'absolute',
                              left: `${pctStart}%`,
                              width: `${pctWidth}%`,
                              height: '100%',
                              background: speaker?.color || 'var(--primary)',
                              borderRadius: 2
                            }}
                          ></div>
                          {segment.isOverlapping && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${pctStart}%`,
                                width: `${pctWidth}%`,
                                height: '100%',
                                background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(234, 88, 12, 0.3) 4px, rgba(234, 88, 12, 0.3) 8px)',
                                borderRadius: 2
                              }}
                            ></div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <select
                            value={segment.speakerId}
                            onChange={(e) => updateSegment(segment.id, { speakerId: e.target.value })}
                            style={{
                              fontSize: 12,
                              padding: '4px 8px',
                              border: '1px solid var(--border)',
                              borderRadius: 4
                            }}
                          >
                            {speakers.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            className={`btn btn-sm ${segment.needsReview ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => toggleSegmentReview(segment.id)}
                          >
                            <AlertTriangle size={12} />
                            {segment.needsReview ? '取消标记' : '标记需复听'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="window-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary" onClick={handleBack}>
            <ArrowLeft size={14} /> 返回录音导入
          </button>
        </div>
        <audio ref={audioRef} preload="auto" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-lg" onClick={handleNext}>
            进入审阅封存 <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
