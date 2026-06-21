import { create } from 'zustand'
import {
  type ProjectState,
  type Speaker,
  type TranscriptionSegment,
  type RecordingFile,
  type CaseInfo,
  type SpeakerRole,
  type NoteType,
  SPEAKER_COLORS
} from '@shared/types'
import { generateId } from '@shared/utils'

const MOCK_SEGMENTS: TranscriptionSegment[] = [
  {
    id: 's1', speakerId: 'sp1', startTime: 0.5, endTime: 8.2,
    text: '大家好，今天请各位来是为了就XX合同履行过程中产生的争议进行调解。我是本次调解的主持人张律师。首先请各位确认身份。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's2', speakerId: 'sp2', startTime: 9.0, endTime: 15.3,
    text: '我是甲方公司的法定代表人李明，代表甲方出席今天的调解。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's3', speakerId: 'sp3', startTime: 15.8, endTime: 22.1,
    text: '我是乙方公司的总经理王芳，我这边还带来了我们的法务顾问赵先生。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's4', speakerId: 'sp4', startTime: 22.5, endTime: 27.0,
    text: '大家好，我是乙方的法务赵明。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's5', speakerId: 'sp1', startTime: 28.0, endTime: 42.5,
    text: '好的，各位的身份已经确认。根据双方之前提交的材料，争议焦点主要集中在第三期货款的支付时间以及货物质量验收标准两个方面。先请甲方陈述一下事实经过。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's6', speakerId: 'sp2', startTime: 43.2, endTime: 72.8,
    text: '好的张律师。按照合同约定，乙方应当在2024年3月15日前完成全部货物交付，我方在验收合格后15个工作日内支付第三期货款共计人民币120万元。但实际上乙方直到4月28日才完成交货，而且到货后我们发现其中有30%的货物存在质量问题，达不到合同约定的A级标准。我们多次发函要求换货或者退款，乙方一直没有给出明确的解决方案。',
    needsReview: false, isOverlapping: false, noteType: 'factual_statement', note: '甲方陈述核心事实'
  },
  {
    id: 's7', speakerId: 'sp3', startTime: 73.0, endTime: 75.5,
    text: '这个我方不认可——',
    needsReview: false, isOverlapping: true
  },
  {
    id: 's8', speakerId: 'sp4', startTime: 73.5, endTime: 76.0,
    text: '请等一下，让我来——',
    needsReview: true, isOverlapping: true
  },
  {
    id: 's9', speakerId: 'sp1', startTime: 76.5, endTime: 79.0,
    text: '请双方依次发言，不要打断。先请甲方继续。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's10', speakerId: 'sp2', startTime: 79.5, endTime: 95.2,
    text: '我们的要求是：乙方应在收到本函后10日内更换不合格货物，或者按照对应货款的两倍支付违约金共计人民币72万元。如果乙方同意这个方案，我们可以协商付款时间。',
    needsReview: false, isOverlapping: false, noteType: 'key_commitment', note: '甲方提出的核心诉求'
  },
  {
    id: 's11', speakerId: 'sp4', startTime: 96.0, endTime: 135.8,
    text: '张律师，我代表乙方回应一下。首先，关于交货延迟，原因是甲方在2月份临时变更了部分货物的技术参数，我方需要重新安排生产线，这个是有邮件往来记录的。其次，关于质量问题，我方出厂时已经按照合同约定进行了检验，甲方提出的所谓质量问题，实际上是他们在仓储过程中保管不当造成的，这一点我们有出厂检验报告和物流签收记录作为证据。甲方要求的两倍违约金没有任何合同和法律依据。',
    needsReview: false, isOverlapping: false, noteType: 'disputed', note: '乙方反驳的关键点，需核对证据'
  },
  {
    id: 's12', speakerId: 'sp2', startTime: 136.0, endTime: 138.5,
    text: '保管不当？你们这是推卸责任！',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's13', speakerId: 'sp1', startTime: 139.0, endTime: 160.5,
    text: '请双方冷静。现在我来归纳一下目前的争议点：第一，交货延迟的原因及责任归属；第二，货物质量问题的成因；第三，违约金的计算方式。建议双方各自出示相关证据，我们逐项核对。先请甲方出具技术参数变更相关的材料。',
    needsReview: false, isOverlapping: false, noteType: 'info', note: '律师归纳的争议焦点'
  },
  {
    id: 's14', speakerId: 'sp2', startTime: 161.0, endTime: 178.2,
    text: '关于参数变更，我们只是在原有基础上做了微调，并且是在乙方确认可以执行之后才发的正式函件，时间是2024年1月12日，距离交货期还有两个月，完全不影响生产安排。乙方在邮件中也明确表示"可以满足"。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's15', speakerId: 'sp4', startTime: 179.0, endTime: 195.6,
    text: '那封邮件中我方同时也明确指出，参数变更后交货时间需要双方重新协商，但甲方之后一直没有就新的交货时间给予书面确认。直到3月10日甲方才回函同意延期至4月底，所以不存在我方延迟交货的问题。',
    needsReview: false, isOverlapping: false, noteType: 'disputed', note: '双方对邮件内容理解存在分歧'
  },
  {
    id: 's16', speakerId: 'sp1', startTime: 196.0, endTime: 215.0,
    text: '好的，关于交货时间的争议双方都有邮件作为证据，我们在后续核对中详细审阅。现在进入下一个议题：货物质量。甲方刚才提到有30%的货物不合格，请具体说明不合格的具体情况以及你们的检测依据。',
    needsReview: false, isOverlapping: false
  },
  {
    id: 's17', speakerId: 'sp2', startTime: 215.5, endTime: 245.8,
    text: '我们收到货物后，委托了XX检测中心进行抽样检测，检测报告显示部分货物的厚度公差超出了合同附件约定的±0.02mm标准，表面粗糙度也不达标。检测报告编号是JC20240512-003，报告原件我们今天带来了，可以给各位传阅。',
    needsReview: false, isOverlapping: false, noteType: 'key_commitment', note: '甲方出具关键证据检测报告'
  },
  {
    id: 's18', speakerId: 'sp4', startTime: 246.0, endTime: 278.3,
    text: '我方对这份检测报告的真实性和关联性都有异议。首先，这是甲方单方委托的检测机构，送检样品是否为我方交付的货物无法确认；其次，合同约定的检验标准是GB/T 1234-2020，而该检测报告使用的是GB/T 5678-2021，两者的检测方法和判定标准不同。我方也有出厂时的检测报告，是按照合同约定标准执行的，全部合格。',
    needsReview: false, isOverlapping: false, noteType: 'disputed', note: '双方检测标准不一致'
  }
]

const MOCK_SPEAKERS: Speaker[] = [
  { id: 'sp1', name: '张律师', role: 'lawyer', color: SPEAKER_COLORS[0] },
  { id: 'sp2', name: '李明', role: 'party', color: SPEAKER_COLORS[1] },
  { id: 'sp3', name: '王芳', role: 'party', color: SPEAKER_COLORS[2] },
  { id: 'sp4', name: '赵明', role: 'agent', color: SPEAKER_COLORS[3] }
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
}

const initialState: ProjectState = {
  caseInfo: null,
  recordingFile: null,
  speakers: [],
  segments: [],
  currentStep: 'import',
  audioUrl: null
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  setCaseInfo: (info) => set({ caseInfo: info }),
  setRecordingFile: (file) => set({ recordingFile: file }),
  setSpeakers: (speakers) => set({ speakers }),
  setSegments: (segments) => set({ segments }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setAudioUrl: (url) => set({ audioUrl: url }),

  addSpeaker: (name, role) => {
    const speakers = get().speakers
    const color = SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length]
    const newSpeaker: Speaker = { id: generateId(), name, role, color }
    set({ speakers: [...speakers, newSpeaker] })
  },

  updateSpeaker: (id, updates) => {
    const speakers = get().speakers.map(s => s.id === id ? { ...s, ...updates } : s)
    set({ speakers })
  },

  removeSpeaker: (id) => {
    set({ speakers: get().speakers.filter(s => s.id !== id) })
  },

  updateSegment: (id, updates) => {
    const segments = get().segments.map(s => s.id === id ? { ...s, ...updates } : s)
    set({ segments })
  },

  toggleSegmentReview: (id) => {
    const segments = get().segments.map(s =>
      s.id === id ? { ...s, needsReview: !s.needsReview } : s
    )
    set({ segments })
  },

  addSegmentNote: (id, note, noteType) => {
    const segments = get().segments.map(s =>
      s.id === id ? { ...s, note, noteType } : s
    )
    set({ segments })
  },

  removeSegmentNote: (id) => {
    const segments = get().segments.map(s =>
      s.id === id ? { ...s, note: undefined, noteType: undefined } : s
    )
    set({ segments })
  },

  loadMockData: () => {
    set({
      caseInfo: {
        caseNumber: 'CASE-2024-0518',
        caseName: 'XX公司合同履行争议调解',
        recordingType: 'mediation',
        date: '2024-05-18',
        location: 'XX律师事务所第三会议室',
        participants: '张律师（主持）、李明（甲方法定代表人）、王芳（乙方总经理）、赵明（乙方法务）'
      },
      recordingFile: {
        path: '/mock/recording.mp3',
        name: '合同争议调解_20240518.mp3',
        size: 45 * 1024 * 1024,
        duration: 3600,
        format: 'mp3'
      },
      speakers: MOCK_SPEAKERS,
      segments: MOCK_SEGMENTS,
      currentStep: 'review',
      audioUrl: null
    })
  },

  resetProject: () => set(initialState)
}))
