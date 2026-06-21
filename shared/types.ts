export type SpeakerRole = 'party' | 'witness' | 'agent' | 'lawyer' | 'other'

export interface Speaker {
  id: string
  name: string
  role: SpeakerRole
  color: string
}

export type NoteType = 'key_commitment' | 'factual_statement' | 'disputed' | 'warning' | 'info'

export interface TranscriptionSegment {
  id: string
  speakerId: string
  startTime: number
  endTime: number
  text: string
  needsReview: boolean
  isOverlapping: boolean
  note?: string
  noteType?: NoteType
}

export interface RecordingFile {
  path: string
  name: string
  size: number
  duration: number
  format: string
}

export interface CaseInfo {
  caseNumber: string
  caseName: string
  recordingType: 'interview' | 'mediation' | 'internal_investigation' | 'other'
  date: string
  location: string
  participants: string
}

export interface ProjectState {
  caseInfo: CaseInfo | null
  recordingFile: RecordingFile | null
  speakers: Speaker[]
  segments: TranscriptionSegment[]
  currentStep: 'import' | 'diarization' | 'review'
  audioUrl: string | null
}

export const SPEAKER_COLORS = [
  '#1e40af',
  '#166534',
  '#9a3412',
  '#7c2d12',
  '#4c1d95',
  '#831843',
  '#0f766e',
  '#1e3a8a'
]

export const SPEAKER_ROLE_LABELS: Record<SpeakerRole, string> = {
  party: '当事人',
  witness: '见证人',
  agent: '代理人',
  lawyer: '律师',
  other: '其他'
}

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  key_commitment: '关键承诺',
  factual_statement: '事实陈述',
  disputed: '存在争议',
  warning: '重要提醒',
  info: '备注信息'
}

export const NOTE_TYPE_COLORS: Record<NoteType, string> = {
  key_commitment: '#fef3c7',
  factual_statement: '#dcfce7',
  disputed: '#fee2e2',
  warning: '#ffedd5',
  info: '#dbeafe'
}

export const RECORDING_TYPE_LABELS: Record<CaseInfo['recordingType'], string> = {
  interview: '访谈',
  mediation: '调解',
  internal_investigation: '内部调查',
  other: '其他'
}
