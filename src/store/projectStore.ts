import { create } from 'zustand'
import {
  type ProjectState,
  type Speaker,
  type TranscriptionSegment,
  type RecordingFile,
  type CaseInfo,
  type SpeakerRole,
  type NoteType,
  SPEAKER_COLORS,
  SPEAKER_ROLE_LABELS
} from '@shared/types'
import { generateId } from '@shared/utils'

const MOCK_TEXTS = [
  '各位好，我们今天的会议主要讨论案件的证据材料整理情况，请大家逐一发言。',
  '我先说明一下目前的进展，我们已经完成了初步的证据收集工作。',
  '关于合同履行情况，我们这边的记录显示对方存在延迟交付的问题。',
  '这点我方需要说明，延迟的原因是甲方临时变更了技术参数。',
  '但变更之后双方没有就新的交货时间达成书面确认。',
  '我们的邮件往来中已经明确提出需要重新协商，但甲方一直没有回复。',
  '接下来请大家看一下这份检测报告，里面显示有部分产品质量不达标。',
  '对这份报告的检测标准我们有异议，合同约定的是另一个标准。',
  '建议双方就争议的几个焦点问题逐一核对证据。',
  '我这边补充一点，关于付款时间的约定，合同第十一条有明确说明。',
  '请等一下，刚才这点我需要再确认一下原始材料。',
  '好的，那我们先暂时休会十分钟，大家可以核对一下手头的文件。',
  '我们重新梳理一下目前确认的事实，以及存在争议的事项。',
  '关于损失的计算方式，我方提供了一份详细的财务清单。',
  '对于这份清单的部分项目，我们认为缺乏相应的凭证支持。',
  '建议双方能够在互谅互让的基础上寻求一个调解方案。',
  '我们可以考虑在付款期限上做出一定让步，但前提是对方先确认质量问题。',
  '好的，这个方案我们可以带回去讨论，下次会议再给答复。',
  '今天的会议就到这里，会议记录将在三个工作日内发送各位核对。',
  '非常感谢各位的参与和配合，散会。'
]

interface ProjectStore extends ProjectState {
  setCaseInfo: (info: CaseInfo | null) => void
  setRecordingFile: (file: RecordingFile | null) => void
  setSpeakers: (speakers: Speaker[]) => void
  addSpeaker: (name: string, role: SpeakerRole) => void
  updateSpeaker: (id: string, updates: Partial<Speaker>) => void
  removeSpeaker: (id: string) => void
  setSegments: (segments: TranscriptionSegment[]) => void
  updateSegment: (id: string, updates: Partial<TranscriptionSegment>) => void
  setCurrentStep: (step: ProjectState['currentStep']) => void
  setAudioUrl: (url: string | null) => void
  toggleSegmentReview: (id: string) => void
  addSegmentNote: (id: string, note: string, noteType: NoteType) => void
  removeSegmentNote: (id: string) => void
  loadMockData: () => void
  resetProject: () => void
  hydrateFromShared: (state: Partial<ProjectState>) => void
  generateMockTranscription: () => Promise<void>
  clearRecordingData: () => void
  setHydratingFlag: (val: boolean) => void
  _hydrating: boolean
}

const initialState: ProjectState = {
  caseInfo: null,
  recordingFile: null,
  speakers: [],
  segments: [],
  currentStep: 'import',
  audioUrl: null
}

function pickState(store: ProjectStore): ProjectState {
  return {
    caseInfo: store.caseInfo,
    recordingFile: store.recordingFile,
    speakers: store.speakers,
    segments: store.segments,
    currentStep: store.currentStep,
    audioUrl: store.audioUrl
  }
}

function broadcastState(store: ProjectStore) {
  if (!store._hydrating && window.electronAPI) {
    try {
      window.electronAPI.setState('project', pickState(store))
    } catch {}
  }
}

function generateSpeakersAndSegments(duration: number): { speakers: Speaker[]; segments: TranscriptionSegment[] } {
  const speakerCount = Math.min(4, Math.max(2, Math.floor(duration / 180) + 2))
  const defaultNames = ['主持人', '当事人甲', '当事人乙', '代理人丙', '证人丁', '律师戊']
  const defaultRoles: SpeakerRole[] = ['lawyer', 'party', 'party', 'agent', 'witness', 'other']

  const speakers: Speaker[] = []
  for (let i = 0; i < speakerCount; i++) {
    speakers.push({
      id: `sp${i + 1}`,
      name: defaultNames[i],
      role: defaultRoles[i],
      color: SPEAKER_COLORS[i % SPEAKER_COLORS.length]
    })
  }

  const segmentCount = Math.min(20, Math.max(8, Math.floor(duration / 45)))
  const segments: TranscriptionSegment[] = []
  const avgSegDuration = (duration * 0.85) / segmentCount
  let currentTime = 3

  for (let i = 0; i < segmentCount; i++) {
    const speakerIdx = i % speakerCount
    const segDuration = Math.max(3, avgSegDuration * (0.6 + Math.random() * 0.8))
    const startTime = currentTime
    const endTime = Math.min(duration - 2, currentTime + segDuration)
    const textIdx = i % MOCK_TEXTS.length

    const isOverlapping = i > 0 && Math.random() < 0.12
    const needsReview = Math.random() < 0.08

    segments.push({
      id: generateId(),
      speakerId: speakers[speakerIdx].id,
      startTime: Math.round(startTime * 10) / 10,
      endTime: Math.round(endTime * 10) / 10,
      text: MOCK_TEXTS[textIdx],
      needsReview,
      isOverlapping
    })

    currentTime = endTime + (isOverlapping ? 0.5 : 1.5 + Math.random() * 2)
  }

  return { speakers, segments }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,
  _hydrating: false,

  hydrateFromShared: (state) => {
    set({
      caseInfo: state.caseInfo ?? null,
      recordingFile: state.recordingFile ?? null,
      speakers: state.speakers ?? [],
      segments: state.segments ?? [],
      currentStep: state.currentStep ?? 'import',
      audioUrl: state.audioUrl ?? null
    })
  },

  setHydratingFlag: (val) => {
    set({ _hydrating: val } as Partial<ProjectStore>)
  },

  clearRecordingData: () => {
    set({
      speakers: [],
      segments: [],
      audioUrl: null
    })
    broadcastState(get())
  },

  setCaseInfo: (info) => {
    set({ caseInfo: info })
    broadcastState(get())
  },

  setRecordingFile: (file) => {
    set({ recordingFile: file })
    broadcastState(get())
  },

  setSpeakers: (speakers) => {
    set({ speakers })
    broadcastState(get())
  },

  setSegments: (segments) => {
    set({ segments })
    broadcastState(get())
  },

  setCurrentStep: (step) => {
    set({ currentStep: step })
    broadcastState(get())
  },

  setAudioUrl: (url) => {
    set({ audioUrl: url })
    broadcastState(get())
  },

  addSpeaker: (name, role) => {
    const speakers = get().speakers
    const color = SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length]
    const newSpeaker: Speaker = { id: generateId(), name, role, color }
    const next = [...speakers, newSpeaker]
    set({ speakers: next })
    broadcastState(get())
  },

  updateSpeaker: (id, updates) => {
    const next = get().speakers.map(s => s.id === id ? { ...s, ...updates } : s)
    set({ speakers: next })
    broadcastState(get())
  },

  removeSpeaker: (id) => {
    const next = get().speakers.filter(s => s.id !== id)
    set({ speakers: next })
    broadcastState(get())
  },

  updateSegment: (id, updates) => {
    const next = get().segments.map(s => s.id === id ? { ...s, ...updates } : s)
    set({ segments: next })
    broadcastState(get())
  },

  toggleSegmentReview: (id) => {
    const next = get().segments.map(s =>
      s.id === id ? { ...s, needsReview: !s.needsReview } : s
    )
    set({ segments: next })
    broadcastState(get())
  },

  addSegmentNote: (id, note, noteType) => {
    const next = get().segments.map(s =>
      s.id === id ? { ...s, note, noteType } : s
    )
    set({ segments: next })
    broadcastState(get())
  },

  removeSegmentNote: (id) => {
    const next = get().segments.map(s =>
      s.id === id ? { ...s, note: undefined, noteType: undefined } : s
    )
    set({ segments: next })
    broadcastState(get())
  },

  generateMockTranscription: async () => {
    const { recordingFile } = get()
    if (!recordingFile) return

    let audioUrl = null
    try {
      audioUrl = await window.electronAPI.pathToAudioUrl(recordingFile.path)
    } catch {
      audioUrl = null
    }

    let duration = recordingFile.duration
    let size = recordingFile.size
    try {
      const info = await window.electronAPI.getAudioDuration(recordingFile.path)
      if (info.success) {
        duration = info.duration
        size = info.size || size
      }
    } catch {
      // use estimated
    }

    const updatedRecordingFile = { ...recordingFile, duration, size }
    const { speakers, segments } = generateSpeakersAndSegments(duration)

    set({
      recordingFile: updatedRecordingFile,
      speakers,
      segments,
      audioUrl
    })
    broadcastState(get())
  },

  loadMockData: async () => {
    const mockRecordingFile: RecordingFile = {
      path: 'C:/demo/合同争议调解_20240518.mp3',
      name: '合同争议调解_20240518.mp3',
      size: 45 * 1024 * 1024,
      duration: 300,
      format: 'mp3'
    }

    let audioUrl = null
    try {
      audioUrl = await window.electronAPI.pathToAudioUrl(mockRecordingFile.path)
    } catch { audioUrl = null }

    const { speakers, segments } = generateSpeakersAndSegments(mockRecordingFile.duration)

    segments[0].text = '大家好，今天请各位来是为了就合同履行过程中产生的争议进行调解。我是本次调解的主持人，首先请各位确认身份。'
    segments[1].text = '我是甲方公司的法定代表人，代表甲方出席今天的调解。'
    segments[2].text = '我是乙方公司的总经理，我这边还带来了我们的法务顾问。'
    segments[3].text = '大家好，我是乙方的法务。'
    if (segments.length > 5) {
      segments[5].noteType = 'factual_statement'
      segments[5].note = '甲方陈述核心事实'
    }
    if (segments.length > 9) {
      segments[9].noteType = 'key_commitment'
      segments[9].note = '甲方提出的核心诉求'
    }
    if (segments.length > 11) {
      segments[11].noteType = 'disputed'
      segments[11].note = '乙方反驳的关键点'
    }

    set({
      caseInfo: {
        caseNumber: 'CASE-2024-0518',
        caseName: 'XX公司合同履行争议调解',
        recordingType: 'mediation',
        date: '2024-05-18',
        location: 'XX律师事务所第三会议室',
        participants: speakers.map(s => `${s.name}（${SPEAKER_ROLE_LABELS[s.role]}）`).join('、')
      },
      recordingFile: mockRecordingFile,
      speakers,
      segments,
      currentStep: 'review',
      audioUrl
    })
    broadcastState(get())
  },

  resetProject: () => {
    set(initialState)
    broadcastState(get())
  }
}))
