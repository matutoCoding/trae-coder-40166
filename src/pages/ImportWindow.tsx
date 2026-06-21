import { useState } from 'react'
import { Upload, FileAudio, ArrowRight, Info, CheckCircle, Loader2, Users, StickyNote, AlertTriangle, MessageSquare, Download, FolderOpen } from 'lucide-react'
import { useProjectStore } from '../store/projectStore'
import type { CaseInfo, RecordingFile } from '@shared/types'
import { RECORDING_TYPE_LABELS } from '@shared/types'
import { formatFileSize, formatTimeHMS } from '@shared/utils'

export default function ImportWindow() {
  const {
    caseInfo, recordingFile, speakers, segments, setCaseInfo, setRecordingFile, setCurrentStep,
    generateMockTranscription, clearRecordingData, hydrateFromShared, setHydratingFlag
  } = useProjectStore()
  const [dragActive, setDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [formData, setFormData] = useState<CaseInfo>(caseInfo || {
    caseNumber: '',
    caseName: '',
    recordingType: 'interview',
    date: new Date().toISOString().split('T')[0],
    location: '',
    participants: ''
  })

  const projectStats = {
    speakers: speakers.length,
    segments: segments.length,
    needReview: segments.filter(s => s.needsReview).length,
    withNotes: segments.filter(s => s.note).length,
    totalDuration: segments.length > 0 ? Math.max(...segments.map(s => s.endTime)) : 0
  }

  const handleExportProject = async () => {
    const state = useProjectStore.getState()
    const projectData = {
      caseInfo: state.caseInfo,
      recordingFile: state.recordingFile,
      speakers: state.speakers,
      segments: state.segments,
      currentStep: state.currentStep,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
    const result = await window.electronAPI.showSaveDialog({
      title: '导出项目数据',
      defaultPath: `${state.caseInfo?.caseNumber || state.caseInfo?.caseName || '项目'}_数据.json`,
      filters: [
        { name: '项目数据', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return
    const writeResult = await window.electronAPI.writeFile(result.filePath, JSON.stringify(projectData, null, 2), 'utf8')
    if (writeResult.success) {
      alert(`项目数据已导出！\n\n保存位置：${result.filePath}`)
    } else {
      alert('导出失败：' + (writeResult.error || '写入文件失败'))
    }
  }

  const handleImportProject = async () => {
    const fileResult = await window.electronAPI.showOpenFileDialog({
      title: '导入项目数据',
      filters: [
        { name: '项目数据', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (fileResult.canceled || !fileResult.filePaths.length) return
    try {
      const readResult = await window.electronAPI.readFile(fileResult.filePaths[0])
      if (!readResult.success || !readResult.content) {
        alert('读取文件失败：' + (readResult.error || '未知错误'))
        return
      }
      const data = JSON.parse(readResult.content)
      if (!data.caseInfo || !data.recordingFile) {
        alert('无效的项目数据文件')
        return
      }
      let audioUrl: string | null = null
      try {
        audioUrl = await window.electronAPI.pathToAudioUrl(data.recordingFile.path)
      } catch { audioUrl = null }
      setHydratingFlag(true)
      hydrateFromShared({
        caseInfo: data.caseInfo,
        recordingFile: data.recordingFile,
        speakers: data.speakers || [],
        segments: data.segments || [],
        currentStep: data.currentStep || 'import',
        audioUrl
      })
      setTimeout(() => setHydratingFlag(false), 200)
      setFormData(data.caseInfo)
      alert(`项目数据已导入！\n案件：${data.caseInfo.caseName}\n转写条数：${(data.segments || []).length}`)
    } catch (e) {
      alert('导入失败：' + (e as Error).message)
    }
  }

  const handleFileSelect = async () => {
    const result = await window.electronAPI.openAudioDialog()
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const fileName = filePath.split(/[\\/]/).pop() || ''
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      const file: RecordingFile = {
        path: filePath,
        name: fileName,
        size: 0,
        duration: 300,
        format: ext
      }
      clearRecordingData()
      setRecordingFile(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const validExts = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma']
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (validExts.includes(ext)) {
        const recording: RecordingFile = {
          path: (file as unknown as { path?: string }).path || file.name,
          name: file.name,
          size: file.size,
          duration: 300,
          format: ext
        }
        clearRecordingData()
        setRecordingFile(recording)
      }
    }
  }

  const handleSubmit = async () => {
    if (!recordingFile) {
      alert('请先导入录音文件')
      return
    }
    if (!formData.caseName.trim()) {
      alert('请填写案件名称')
      return
    }

    setIsProcessing(true)
    try {
      setCaseInfo(formData)
      if (useProjectStore.getState().segments.length === 0) {
        await generateMockTranscription()
      }
      setCurrentStep('diarization')
      window.electronAPI.openWindow('diarization')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleInputChange = (field: keyof CaseInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const canProceed = recordingFile && formData.caseName.trim() && !isProcessing

  return (
    <div className="window-container">
      <header className="window-header">
        <div className="window-header-title">
          <h1>会议取证转写工具</h1>
          <span className="step-badge">第一步 · 录音导入</span>
        </div>
        <div className="window-header-actions">
          <span style={{ fontSize: 12, opacity: 0.8 }}>v1.0.0</span>
        </div>
      </header>

      <div className="step-indicator">
        <div className="step-item active">
          <div className="step-number">1</div>
          <span>录音导入</span>
        </div>
        <div className="step-divider"></div>
        <div className="step-item">
          <div className="step-number">2</div>
          <span>声纹分轨</span>
        </div>
        <div className="step-divider"></div>
        <div className="step-item">
          <div className="step-number">3</div>
          <span>审阅封存</span>
        </div>
      </div>

      <div className="window-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
          <div className="card">
            <div className="card-header">
              <h2>录音文件</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>支持 MP3 / WAV / M4A / AAC / FLAC 等格式</span>
            </div>
            <div className="card-body">
              {!recordingFile ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={handleFileSelect}
                  style={{
                    border: `2px dashed ${dragActive ? 'var(--primary-light)' : 'var(--border)'}`,
                    borderRadius: 8,
                    padding: 48,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: dragActive ? '#eff6ff' : 'transparent'
                  }}
                >
                  <Upload size={48} style={{ marginBottom: 16, color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                    点击或拖拽文件到此处
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    支持导入访谈、调解或内部调查的录音文件
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 16,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8
                }}>
                  <div style={{
                    width: 48, height: 48,
                    borderRadius: 8,
                    background: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    <FileAudio size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#166534' }}>
                      {recordingFile.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 16 }}>
                      <span>{recordingFile.size > 0 ? formatFileSize(recordingFile.size) : '读取中...'}</span>
                      <span>{recordingFile.format.toUpperCase()}</span>
                      <CheckCircle size={14} style={{ color: '#166534' }} />
                      <span style={{ color: '#166534' }}>已导入</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleFileSelect}
                  >
                    重新选择
                  </button>
                </div>
              )}

              <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <Info size={16} style={{ flexShrink: 0, color: 'var(--info)', marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>录音文件要求</div>
                    <ul style={{ paddingLeft: 18, margin: 0 }}>
                      <li>建议使用 16kHz 以上采样率的单声道或双声道音频</li>
                      <li>文件大小建议不超过 500MB，时长建议 4 小时以内</li>
                      <li>导入后系统将自动进行声纹识别和初步转写</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>案件信息</h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>用于归档和导出</span>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label>案件编号</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="如：CASE-2024-001"
                    value={formData.caseNumber}
                    onChange={e => handleInputChange('caseNumber', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>案件名称<span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="请输入案件名称"
                    value={formData.caseName}
                    onChange={e => handleInputChange('caseName', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>录音类型</label>
                  <select
                    className="form-control"
                    value={formData.recordingType}
                    onChange={e => handleInputChange('recordingType', e.target.value)}
                  >
                    {Object.entries(RECORDING_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>会议日期</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.date}
                    onChange={e => handleInputChange('date', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>会议地点</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="如：XX律师事务所第一会议室"
                  value={formData.location}
                  onChange={e => handleInputChange('location', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>参会人员</label>
                <textarea
                  className="form-control"
                  placeholder="请输入所有参会人员姓名及身份，如：张三（当事人）、李四（律师）"
                  value={formData.participants}
                  onChange={e => handleInputChange('participants', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        {(caseInfo || segments.length > 0) && (
          <div style={{ maxWidth: 1200, margin: '24px auto 0' }}>
            <div className="card">
              <div className="card-header">
                <h2>项目概览</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>当前项目数据统计</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
                  <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                    <Users size={20} style={{ color: 'var(--primary)', marginBottom: 8 }} />
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{projectStats.speakers}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>发言人数</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                    <MessageSquare size={20} style={{ color: 'var(--info)', marginBottom: 8 }} />
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{projectStats.segments}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>转写条数</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                    <AlertTriangle size={20} style={{ color: '#d97706', marginBottom: 8 }} />
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{projectStats.needReview}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>需复听</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                    <StickyNote size={20} style={{ color: '#2563eb', marginBottom: 8 }} />
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{projectStats.withNotes}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>已备注</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                    <FileAudio size={20} style={{ color: '#166534', marginBottom: 8 }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
                      {recordingFile?.name || '-'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {recordingFile ? `${formatFileSize(recordingFile.size)} · ${formatTimeHMS(projectStats.totalDuration || recordingFile.duration)}` : '录音文件'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                    <Info size={20} style={{ color: 'var(--text-secondary)', marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
                      {caseInfo?.caseName || '-'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {caseInfo?.caseNumber || '案件信息'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="window-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            请确保录音文件来源合法，符合相关法律法规要求
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleImportProject}
          >
            <FolderOpen size={12} /> 导入项目
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportProject}
            disabled={!caseInfo}
          >
            <Download size={12} /> 导出项目
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={!canProceed}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                正在识别声纹...
              </>
            ) : (
              <>
                进入声纹分轨
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
