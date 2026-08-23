import { create } from 'zustand'

export interface HypothesisEvent {
  hypId: string
  parentId: string | null
  depth: number
  statement: string
  rationale?: string
  sql?: string
  queryNum: number
  verdict?: string
  confidence?: number
  reasoning?: string
  dbMs?: number
  rowsReturned?: number
  rowsScanned?: number
  resultSummary?: string
  timestamp: string
}

export interface InvestigationStats {
  queriesExecuted: number
  rowsInScope: number
  totalDbMs: number
  hypothesesKilled: number
  hypothesesConfirmed: number
  maxDepth: number
  elapsedMs: number
}

export interface CaseFile {
  runId: string
  question: string
  finding: string
  finalConfidence: number
  summary: {
    queriesExecuted: number
    rowsInScope: number
    totalDbMs: number
    elapsedSeconds: number
    hypothesesRefuted: number
    maxDepth: number
  }
  evidenceChain: Array<{
    queryNum: number
    statement: string
    verdict: string
    confidence: number
    sql?: string
    resultSummary?: string
    reasoning?: string
  }>
  ruledOut: Array<{
    queryNum: number
    statement: string
    reasoning?: string
    sql?: string
  }>
  allHypotheses: Array<{
    queryNum: number
    statement: string
    verdict: string
    confidence: number
    reasoning?: string
    depth: number
    parentId: string | null
  }>
}

export type InvestigationPhase =
  | 'idle'
  | 'connecting'
  | 'generating'
  | 'running'
  | 'completed'
  | 'error'

interface InvestigationStore {
  phase: InvestigationPhase
  question: string
  runId: string | null
  stats: InvestigationStats
  hypotheses: HypothesisEvent[]
  currentPhase: string
  caseFile: CaseFile | null
  logs: Array<{ type: string; message: string; timestamp: string }>

  setPhase: (phase: InvestigationPhase) => void
  setQuestion: (q: string) => void
  reset: () => void
  addHypothesis: (h: HypothesisEvent) => void
  updateHypothesis: (hypId: string, data: Partial<HypothesisEvent>) => void
  addLog: (type: string, message: string) => void
  updateStats: (data: Partial<InvestigationStats>) => void
  setCaseFile: (cf: CaseFile) => void
}

const initialStats: InvestigationStats = {
  queriesExecuted: 0,
  rowsInScope: 0,
  totalDbMs: 0,
  hypothesesKilled: 0,
  hypothesesConfirmed: 0,
  maxDepth: 0,
  elapsedMs: 0,
}

export const useInvestigationStore = create<InvestigationStore>((set) => ({
  phase: 'idle',
  question: 'Fare-per-mile in the outer boroughs has drifted upward relative to Manhattan over the last two years. Find out what is driving it.',
  runId: null,
  stats: { ...initialStats },
  hypotheses: [],
  currentPhase: '',
  caseFile: null,
  logs: [],

  setPhase: (phase) => set({ phase }),
  setQuestion: (q) => set({ question: q }),
  reset: () =>
    set({
      phase: 'idle',
      runId: null,
      stats: { ...initialStats },
      hypotheses: [],
      currentPhase: '',
      caseFile: null,
      logs: [],
    }),
  addHypothesis: (h) =>
    set((s) => ({ hypotheses: [...s.hypotheses, h] })),
  updateHypothesis: (hypId, data) =>
    set((s) => ({
      hypotheses: s.hypotheses.map((h) =>
        h.hypId === hypId ? { ...h, ...data } : h
      ),
    })),
  addLog: (type, message) =>
    set((s) => ({
      logs: [
        ...s.logs,
        { type, message, timestamp: new Date().toISOString() },
      ],
    })),
  updateStats: (data) =>
    set((s) => ({ stats: { ...s.stats, ...data } })),
  setCaseFile: (cf) => set({ caseFile: cf, phase: 'completed' }),
}))
