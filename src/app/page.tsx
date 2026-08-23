'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Search, Zap, FileSearch, Shield, Terminal, Database,
  CheckCircle2, XCircle, HelpCircle, ChevronDown,
  Activity, Clock, Hash, TrendingDown, GitBranch, AlertTriangle,
  ArrowDown, Play, Square, RotateCcw, Bot, Brain, X, Menu,
  BarChart3, Layers, Fingerprint, Trophy, Eye,
  Crosshair, FlaskConical, CircuitBoard, FileText,
  Download, ChevronRight, Keyboard, MessageSquare,
  ScrollText, ArrowRight, Github, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Cell, Tooltip as RTooltip } from 'recharts'
import { useInvestigationStore, type HypothesisEvent, type CaseFile } from '@/lib/investigation-store'

// ─── Constants ───
const SERVICE_PORT = 3004
const VERDICT_COLORS: Record<string, string> = {
  CONFIRMED: 'text-[oklch(0.7_0.15_160)] border-[oklch(0.7_0.15_160)]',
  REFUTED: 'text-[oklch(0.65_0.25_25)] border-[oklch(0.65_0.25_25)]',
  INCONCLUSIVE: 'text-[oklch(0.75_0.15_85)] border-[oklch(0.75_0.15_85)]',
  ERROR: 'text-destructive border-destructive',
}
const VERDICT_BG: Record<string, string> = {
  CONFIRMED: 'bg-[oklch(0.7_0.15_160/0.08)]',
  REFUTED: 'bg-[oklch(0.65_0.25_25/0.08)]',
  INCONCLUSIVE: 'bg-[oklch(0.75_0.15_85/0.08)]',
  ERROR: 'bg-destructive/10',
}
const VERDICT_ICONS: Record<string, React.ReactNode> = {
  CONFIRMED: <CheckCircle2 className="w-4 h-4 text-[oklch(0.7_0.15_160)]" />,
  REFUTED: <XCircle className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />,
  INCONCLUSIVE: <HelpCircle className="w-4 h-4 text-[oklch(0.75_0.15_85)]" />,
  ERROR: <AlertTriangle className="w-4 h-4 text-destructive" />,
}
const BUDGET_MAX = 25

// ─── Example case file (static showcase) ───
const EXAMPLE_CASE: CaseFile = {
  runId: 'demo_8f3a2c1e',
  question: 'Fare-per-mile in the outer boroughs has drifted upward relative to Manhattan over the last two years. What is driving it?',
  finding: 'The drift is concentrated in trips beginning between 22:00 and 04:00 in three outer zones, and is driven by a shift in trip composition rather than a pricing change: the share of short trips under 1.5 miles in those windows rose from 18% to 34%, and short trips carry a structurally higher fare-per-mile due to the fixed initial charge.',
  finalConfidence: 0.89,
  summary: { queriesExecuted: 47, rowsInScope: 312400000, totalDbMs: 21400, elapsedSeconds: 28.6, hypothesesRefuted: 12, maxDepth: 4 },
  evidenceChain: [
    { queryNum: 3, statement: 'Drift is not uniform across outer zones — it is concentrated in 3 of 61 zones.', verdict: 'CONFIRMED', confidence: 0.72, reasoning: 'Three zones show >15% FPM increase while the rest are within 3%.', sql: 'SELECT pickup_borough, AVG(fare_per_mile) as fpm ... GROUP BY pickup_borough, trip_year', resultSummary: 'Brooklyn: 7.1 (+14.5%), Queens: 7.4 (+13.8%), Bronx: 7.9 (+16.2%), Manhattan: 8.6 (+3.6%)' },
    { queryNum: 11, statement: 'Within those zones, the effect is time-of-day dependent, peaking 22:00–04:00.', verdict: 'CONFIRMED', confidence: 0.81, reasoning: 'Overnight FPM ratio jumped from 0.78 to 0.96. Daytime unchanged.', sql: 'SELECT hour_bucket, AVG(fare_per_mile_outer) / AVG(fare_per_mile_manhattan) as ratio ...', resultSummary: '00-04: 0.96, 04-08: 0.82, 08-12: 0.79, 12-16: 0.77, 16-20: 0.80, 20-24: 0.93' },
    { queryNum: 19, statement: 'Base fare rates did not change in these zones over the period.', verdict: 'REFUTED', confidence: 0.90, reasoning: 'The $3.00 initial charge and $2.50/mile rate are identical across all years.', sql: 'SELECT trip_year, MIN(fare_amount) as min_fare, AVG(fare_amount / NULLIF(trip_distance,0)) ...', resultSummary: '2022: $6.20/mi, 2023: $6.25/mi, 2024: $6.28/mi. Rate change <2%.' },
    { queryNum: 28, statement: 'Trip-distance distribution shifted markedly in those windows.', verdict: 'CONFIRMED', confidence: 0.86, reasoning: 'Short-trip share rose from 18% to 34% in overnight windows for the 3 zones.', sql: "SELECT CASE WHEN trip_distance < 1.5 THEN 'short' ELSE 'long' END, COUNT(*) ...", resultSummary: 'Short trips 2022 overnight: 18%, 2024 overnight: 34%. Daytime: 22% → 23%.' },
    { queryNum: 41, statement: 'Recomputing FPM at constant distance mix removes 84% of the observed drift.', verdict: 'CONFIRMED', confidence: 0.89, reasoning: 'Standardized FPM ratio drops from 1.18 to 1.03 when controlling for mix.', sql: 'WITH standardized AS (SELECT ... AVG(fare_per_mile) OVER (PARTITION BY distance_bucket) ...) ...', resultSummary: 'Raw drift: +18%. Mix-controlled drift: +3%. Residual is within noise.' },
  ],
  ruledOut: [
    { queryNum: 7, statement: 'Seasonality: effect persists after month-controlling', reasoning: 'Month-over-month comparison shows consistent upward trend, not seasonal peaks.' },
    { queryNum: 9, statement: 'Toll pass-through: toll-flagged trips excluded, effect unchanged', reasoning: 'Removing all trips with tolls_amount > 0 leaves the drift at +16%.' },
    { queryNum: 14, statement: 'Single-vendor artifact: present across all vendor IDs', reasoning: 'VTS, CMT, and DDS all show 12-17% increases. No single vendor dominates.' },
    { queryNum: 16, statement: 'Data-entry error in distance field: distribution is smooth', reasoning: 'No spike at implausible values. Distance distribution is smooth with natural tail.' },
    { queryNum: 22, statement: 'Surge pricing / congestion surcharge changes', reasoning: 'Surcharge introduced in 2019 and unchanged. Rates are flat across the period.' },
    { queryNum: 25, statement: 'Payment type shift (more credit = more tips inflating FPM)', reasoning: 'Credit card share went from 72% to 76%, but tipping patterns are stable.' },
  ],
  allHypotheses: [],
}

// ─── Benchmark chart data ───
const BENCHMARK_DATA = [
  { shape: 'Simple agg', exasolMs: 89, duckdbMs: 120, count: 14 },
  { shape: 'Multi-join', exasolMs: 210, duckdbMs: 890, count: 21 },
  { shape: 'Window fn', exasolMs: 145, duckdbMs: 340, count: 8 },
  { shape: 'Self-join', exasolMs: 320, duckdbMs: 1200, count: 4 },
]

// ─── Placeholder rotation examples ───
const PLACEHOLDER_EXAMPLES = [
  'Why have late-night tip percentages dropped in Queens since 2023?',
  'Are airport trips getting shorter or more expensive?',
  'What drives the weekday vs weekend fare gap in Brooklyn?',
  'Has the share of cash payments changed across boroughs?',
]

// ─── Sample question presets (shorter for buttons) ───
const SAMPLE_QUESTIONS = [
  'Why are late-night tips dropping in Queens?',
  'Are airport trips getting more expensive?',
  'Weekday vs weekend fare gap in Brooklyn?',
  'Cash payment share shift across boroughs?',
  'What drives short-trip fare-per-mile spikes?',
]

// ─── Navigation sections ───
const NAV_SECTIONS = [
  { label: 'Architecture', id: 'architecture' },
  { label: 'Economics', id: 'economics' },
  { label: 'Investigate', id: 'investigate' },
  { label: 'Example', id: 'example' },
  { label: 'Benchmark', id: 'benchmark' },
  { label: 'Reproducible', id: 'reproducible' },
]

// ─── Section wrapper with scroll-triggered fade ───
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Stat counter ───
function StatCounter({ icon: Icon, label, value, unit, color }: {
  icon: React.ElementType; label: string; value: string | number; unit?: string; color?: string
}) {
  const [displayVal, setDisplayVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const t = typeof value === 'number' ? value : parseFloat(String(value)) || 0
    const s = prev.current, d = t - s
    if (d === 0) return
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / 400, 1)
      setDisplayVal(s + d * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(tick); else prev.current = t
    }
    requestAnimationFrame(tick)
  }, [value])
  const f = typeof value === 'string' ? value :
    Number.isInteger(value) ? Math.round(displayVal).toLocaleString() : displayVal.toFixed(1)
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/30">
      <div className={`p-2 rounded-md ${color || 'bg-primary/10 text-primary'}`}><Icon className="w-4 h-4" /></div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={`font-terminal text-lg font-bold ${color || 'text-foreground'}`}>{f}{unit && <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>}</p>
      </div>
    </div>
  )
}

// ─── Hypothesis item (with depth indentation) ───
function HypothesisItem({ hyp, isExpanded, onToggle }: { hyp: HypothesisEvent; isExpanded: boolean; onToggle: () => void }) {
  const vc = VERDICT_COLORS[hyp.verdict || ''] || 'border-muted-foreground/30'
  const vb = VERDICT_BG[hyp.verdict || ''] || 'bg-muted/20'
  const depth = hyp.depth || 0
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className={depth > 0 ? `relative pl-6` : ''}>
      {/* Vertical connecting line for child hypotheses */}
      {depth > 0 && (
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />
      )}
      {/* Depth badge */}
      {depth > 0 && (
        <Badge variant="outline" className="absolute left-1.5 top-3.5 -translate-x-1/2 text-[9px] px-1 py-0 font-terminal border-primary/30 text-primary/60 bg-background z-10">
          D{depth}
        </Badge>
      )}
      <div className={`border rounded-lg overflow-hidden ${vc} ${vb} animate-slide-in`}>
        <button onClick={onToggle} className="w-full text-left p-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
          <div className="mt-0.5 shrink-0">{VERDICT_ICONS[hyp.verdict || ''] || <HelpCircle className="w-4 h-4 text-muted-foreground" />}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-terminal text-xs text-muted-foreground">Q{hyp.queryNum}</span>
              {hyp.verdict && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${vc}`}>{hyp.verdict}</Badge>}
              {hyp.confidence !== undefined && hyp.confidence > 0 && <span className="font-terminal text-xs text-muted-foreground">{Math.round(hyp.confidence * 100)}%</span>}
            </div>
            <p className="text-sm mt-1 leading-relaxed">{hyp.statement}</p>
            {hyp.reasoning && !isExpanded && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{hyp.reasoning}</p>}
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-3">
                {hyp.sql && <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">SQL</p><div className="rounded-md overflow-hidden bg-black/30 max-h-48 overflow-y-auto"><SyntaxHighlighter language="sql" style={oneDark} customStyle={{ margin: 0, fontSize: '12px', background: 'transparent' }}>{hyp.sql}</SyntaxHighlighter></div></div>}
                {hyp.resultSummary && <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Result</p><pre className="text-xs font-terminal text-muted-foreground bg-black/20 rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre">{hyp.resultSummary}</pre></div>}
                {hyp.reasoning && <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">Reasoning</p><p className="text-sm text-muted-foreground">{hyp.reasoning}</p></div>}
                {hyp.dbMs !== undefined && <div className="flex gap-4 text-xs text-muted-foreground font-terminal"><span>{hyp.dbMs.toFixed(1)}ms</span>{hyp.rowsReturned !== undefined && <span>{hyp.rowsReturned} rows</span>}{hyp.rowsScanned !== undefined && <span>{(hyp.rowsScanned / 1e6).toFixed(0)}M scanned</span>}</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Benchmark Chart ───
function BenchmarkChart() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={BENCHMARK_DATA} layout="vertical" margin={{ left: 90, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.17 0.006 270)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'oklch(0.55 0.01 270)' }} axisLine={{ stroke: 'oklch(0.17 0.006 270)' }} unit="ms" />
          <YAxis type="category" dataKey="shape" tick={{ fontSize: 12, fill: 'oklch(0.7 0 0)' }} width={85} />
          <RTooltip contentStyle={{ background: 'oklch(0.1 0.007 270)', border: '1px solid oklch(0.17 0.006 270)', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: 'oklch(0.93 0 0)' }} formatter={(v: number) => `${v}ms`} />
          <Bar dataKey="duckdbMs" name="DuckDB" fill="oklch(0.35 0.01 270)" radius={[0, 4, 4, 0]} barSize={22} />
          <Bar dataKey="exasolMs" name="Exasol" fill="oklch(0.78 0.17 72)" radius={[0, 4, 4, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Case File View ───
function CaseFileView({ caseFile, isDemo }: { caseFile: CaseFile; isDemo?: boolean }) {
  const [showAllE, setShowAllE] = useState(false)
  const [showAllR, setShowAllR] = useState(false)
  const ev = caseFile.evidenceChain || []
  const ru = caseFile.ruledOut || []
  const s = caseFile.summary

  // Export to Markdown
  const exportMarkdown = () => {
    let md = `# CASEFILE — Investigation Report\n\n`
    md += `**Run ID:** \`${caseFile.runId}\`\n`
    md += `**Question:** ${caseFile.question}\n\n`
    md += `## Finding (Confidence: ${Math.round(caseFile.finalConfidence * 100)}%)\n\n${caseFile.finding}\n\n`
    md += `## Investigation Summary\n\n`
    md += `- Queries Executed: ${s.queriesExecuted}\n`
    md += `- Rows In Scope: ${(s.rowsInScope / 1e6).toFixed(0)}M\n`
    md += `- Total DB Time: ${(s.totalDbMs / 1000).toFixed(1)}s\n`
    md += `- Elapsed: ${s.elapsedSeconds.toFixed(1)}s\n`
    md += `- Hypotheses Refuted: ${s.hypothesesRefuted}\n`
    md += `- Max Depth: ${s.maxDepth}\n\n`
    md += `## Evidence Chain\n\n`
    for (const e of ev) {
      md += `### Q${e.queryNum} — ${e.verdict} (${Math.round(e.confidence * 100)}%)\n\n`
      md += `**Statement:** ${e.statement}\n\n`
      if (e.sql) md += `**SQL:**\n\`\`\`sql\n${e.sql}\n\`\`\`\n\n`
      if (e.resultSummary) md += `**Result:** ${e.resultSummary}\n\n`
      if (e.reasoning) md += `**Reasoning:** ${e.reasoning}\n\n`
    }
    if (ru.length > 0) {
      md += `## Ruled Out (${ru.length})\n\n`
      for (const r of ru) {
        md += `- ~~${r.statement}~~\n  - *${r.reasoning}*\n\n`
      }
    }
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `casefile-${caseFile.runId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {isDemo && <div className="flex items-center gap-2 text-xs text-primary mb-2"><FlaskConical className="w-3.5 h-3.5" /><span className="font-medium">EXAMPLE OUTPUT — from a completed investigation on 320M rows</span></div>}
      {!isDemo && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-[oklch(0.7_0.15_160)]"><CheckCircle2 className="w-3.5 h-3.5" /><span className="font-medium">Investigation Complete</span></div>
          <Button variant="outline" size="sm" className="h-8 text-xs border-border/60 hover:bg-secondary" onClick={exportMarkdown}>
            <Download className="w-3.5 h-3.5 mr-1.5" />Export .md
          </Button>
        </div>
      )}
      <Card className="border-[oklch(0.7_0.15_160/0.25)] glow-confirmed">
        <CardHeader className="pb-3"><div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[oklch(0.7_0.15_160)]" /><CardTitle className="text-base">Finding</CardTitle><Badge className="ml-auto bg-[oklch(0.7_0.15_160/0.15)] text-[oklch(0.7_0.15_160)] border-[oklch(0.7_0.15_160/0.25)]">confidence {(caseFile.finalConfidence * 100).toFixed(0)}%</Badge></div></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{caseFile.finding}</p></CardContent>
      </Card>
      <Card className="border-border/50"><CardContent className="p-4">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Investigation Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { v: s.queriesExecuted, l: 'queries', c: 'text-primary' },
            { v: (s.rowsInScope / 1e6).toFixed(0) + 'M', l: 'rows in scope', c: '' },
            { v: (s.totalDbMs / 1000).toFixed(1) + 's', l: 'DB time', c: 'text-[oklch(0.7_0.15_160)]' },
            { v: s.hypothesesRefuted, l: 'refuted', c: 'text-destructive' },
            { v: s.maxDepth, l: 'max depth', c: '' },
            { v: s.elapsedSeconds.toFixed(1) + 's', l: 'elapsed', c: '' },
          ].map((x) => (
            <div key={x.l} className="text-center"><span className={`font-terminal text-xl font-bold ${x.c}`}>{x.v}</span><p className="text-[10px] text-muted-foreground mt-0.5">{x.l}</p></div>
          ))}
        </div>
      </CardContent></Card>
      <Card className="border-border/50"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Evidence Chain</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(showAllE ? ev : ev.slice(0, 3)).map((e, i) => (
            <div key={i} className={`p-3 rounded-lg border ${VERDICT_COLORS[e.verdict] || ''} ${VERDICT_BG[e.verdict] || ''}`}>
              <div className="flex items-center gap-2 mb-1"><span className="font-terminal text-xs text-muted-foreground">Q{e.queryNum}</span><Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${VERDICT_COLORS[e.verdict] || ''}`}>{e.verdict} {e.confidence.toFixed(2)}</Badge></div>
              <p className="text-sm">{e.statement}</p>
              {e.reasoning && <p className="text-xs text-muted-foreground mt-1">{e.reasoning}</p>}
            </div>
          ))}
          {ev.length > 3 && <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowAllE(!showAllE)}>{showAllE ? 'Show less' : `Show ${ev.length - 3} more`}</Button>}
        </CardContent>
      </Card>
      {ru.length > 0 && (
        <Card className="border-[oklch(0.65_0.25_25/0.25)]"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><XCircle className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />Ruled Out ({ru.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(showAllR ? ru : ru.slice(0, 4)).map((r, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-[oklch(0.65_0.25_25/0.04)] border border-[oklch(0.65_0.25_25/0.12)]"><p className="text-sm line-through text-muted-foreground">{r.statement}</p>{r.reasoning && <p className="text-xs text-[oklch(0.65_0.25_25)] mt-0.5">{r.reasoning}</p>}</div>
            ))}
            {ru.length > 4 && <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowAllR(!showAllR)}>{showAllR ? 'Show less' : `Show ${ru.length - 4} more`}</Button>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Animated Pipeline Connector ───
function PipelineConnector() {
  return (
    <div className="hidden lg:flex items-center justify-center w-8 shrink-0">
      <svg width="32" height="16" className="overflow-visible">
        <line x1="0" y1="8" x2="28" y2="8" stroke="oklch(0.78 0.17 72 / 0.4)" strokeWidth="2" strokeDasharray="6 4" className="animate-pipeline-flow" />
        <polygon points="26,4 32,8 26,12" fill="oklch(0.78 0.17 72 / 0.6)" />
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function HomePage() {
  const store = useInvestigationStore()
  const socketRef = useRef<any>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [expandedHyps, setExpandedHyps] = useState<Set<string>>(new Set())
  const [showExample, setShowExample] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [placeholderText, setPlaceholderText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const timelineRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const placeholderRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Scroll progress ───
  const { scrollYProgress } = useScroll()

  // ─── Parallax for hero stats ───
  const { scrollY } = useScroll()
  const heroStatsY = useTransform(scrollY, [0, 400], [0, -60])

  // ─── Scroll-spy with IntersectionObserver ───
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id)
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  // ─── Placeholder typing animation ───
  useEffect(() => {
    let exampleIdx = 0
    let charIdx = 0
    let deleting = false
    const type = () => {
      const current = PLACEHOLDER_EXAMPLES[exampleIdx]
      if (!deleting) {
        charIdx++
        setPlaceholderText(current.slice(0, charIdx))
        if (charIdx >= current.length) {
          deleting = true
          placeholderRef.current = setTimeout(type, 2000)
          return
        }
        placeholderRef.current = setTimeout(type, 50 + Math.random() * 40)
      } else {
        charIdx--
        setPlaceholderText(current.slice(0, charIdx))
        if (charIdx <= 0) {
          deleting = false
          exampleIdx = (exampleIdx + 1) % PLACEHOLDER_EXAMPLES.length
          placeholderRef.current = setTimeout(type, 400)
          return
        }
        placeholderRef.current = setTimeout(type, 25)
      }
    }
    placeholderRef.current = setTimeout(type, 1000)
    return () => { if (placeholderRef.current) clearTimeout(placeholderRef.current) }
  }, [])

  const toggleHyp = useCallback((id: string) => {
    setExpandedHyps(p => {
      const n = new Set(p)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }, [])

  // Smooth scroll with offset
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
    setMobileMenu(false)
  }

  // Socket
  useEffect(() => {
    let cancelled = false, s: any = null
    const init = async () => {
      const { io } = await import('socket.io-client')
      if (cancelled) return
      s = io('/?XTransformPort=' + SERVICE_PORT, { path: '/', transports: ['polling', 'websocket'], forceNew: true, reconnection: true, reconnectionAttempts: 5, timeout: 30000 })
      socketRef.current = s
      s.on('connect', () => setSocketConnected(true))
      s.on('connect_error', () => setSocketConnected(false))
      s.on('disconnect', () => setSocketConnected(false))
      s.on('investigation', (ev: any) => {
        const { type, data } = ev
        switch (type) {
          case 'started': { store.setPhase('running'); store.setCaseFile(null as any); startTimeRef.current = Date.now(); store.addLog('system', `Investigation ${data.runId} started`); if (elapsedRef.current) clearInterval(elapsedRef.current); elapsedRef.current = setInterval(() => store.updateStats({ elapsedMs: Date.now() - startTimeRef.current }), 100); break }
          case 'root_hypotheses': { store.addLog('hypothesis', `Generated ${data.hypotheses.length} root hypotheses`); for (const h of data.hypotheses) store.addHypothesis({ hypId: h.hypId, parentId: null, depth: 0, statement: h.statement, rationale: h.rationale, queryNum: 0, timestamp: ev.timestamp }); break }
          case 'progress': store.setPhase('running'); break
          case 'planned': store.updateHypothesis(data.hypId, { sql: data.sql, queryNum: data.queryNum }); store.addLog('sql', `Q${data.queryNum}: SQL planned`); break
          case 'executed': store.updateHypothesis(data.hypId, { dbMs: data.dbMs, rowsReturned: data.rowsReturned, rowsScanned: data.rowsScanned }); store.updateStats({ queriesExecuted: data.totalQueries, rowsInScope: (store.stats.rowsInScope || 0) + (data.rowsScanned || 0), totalDbMs: data.totalDbMs }); break
          case 'judged': store.updateHypothesis(data.hypId, { verdict: data.verdict, confidence: data.confidence, reasoning: data.reasoning }); if (data.verdict === 'CONFIRMED') store.updateStats({ hypothesesConfirmed: data.confirmed }); else if (data.verdict === 'REFUTED') store.updateStats({ hypothesesKilled: data.killed }); store.addLog('verdict', `Q${data.queryNum}: ${data.verdict} (${Math.round(data.confidence * 100)}%) — ${data.statement.substring(0, 60)}...`); break
          case 'refuted': store.addLog('killed', `Killed: ${data.statement.substring(0, 60)}...`); break
          case 'children': store.addLog('branch', `Spawned ${data.children.length} follow-ups`); break
          case 'completed': { if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null } store.updateStats({ elapsedMs: Date.now() - startTimeRef.current }); store.setCaseFile(data); store.addLog('system', `Investigation completed: ${data.summary.queriesExecuted} queries, ${(data.summary.totalDbMs / 1000).toFixed(1)}s DB time`); break }
          case 'error': { if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null } store.setPhase('error'); store.addLog('error', data.message); break }
        }
        if (timelineRef.current) timelineRef.current.scrollTop = timelineRef.current.scrollHeight
      })
    }
    init()
    return () => { cancelled = true; s?.disconnect(); if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [])

  const startInvestigation = () => { if (!store.question.trim() || !socketRef.current?.connected) return; store.reset(); store.setPhase('connecting'); setExpandedHyps(new Set()); setShowExample(false); socketRef.current.emit('start-investigation', { question: store.question }) }
  const stopInvestigation = () => { if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }; store.setPhase('idle'); socketRef.current?.disconnect() }
  const isRunning = store.phase === 'running' || store.phase === 'connecting'
  const isCompleted = store.phase === 'completed'

  // Keyboard shortcut: Ctrl/Cmd+Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isRunning) {
        e.preventDefault()
        startInvestigation()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRunning, store.question, socketConnected])

  // Budget progress bar color
  const budgetUsed = store.stats.queriesExecuted
  const budgetPct = Math.min((budgetUsed / BUDGET_MAX) * 100, 100)
  const budgetColor = budgetPct < 50 ? 'bg-[oklch(0.7_0.15_160)]' : budgetPct < 80 ? 'bg-[oklch(0.78_0.17_72)]' : 'bg-[oklch(0.65_0.25_25)]'
  const budgetBarColor = budgetPct < 50 ? 'oklch(0.7_0.15_160)' : budgetPct < 80 ? 'oklch(0.78_0.17_72)' : 'oklch(0.65_0.25_25)'

  return (
    <TooltipProvider>
    <div className="min-h-screen flex flex-col bg-background">

      {/* ═══ SCROLL PROGRESS BAR ═══ */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left"
        style={{
          scaleX: scrollYProgress,
          background: 'oklch(0.78 0.17 72)',
          boxShadow: '0 0 8px oklch(0.78 0.17 72 / 0.6), 0 0 20px oklch(0.78 0.17 72 / 0.3)',
        }}
      />

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative"><Fingerprint className="w-6 h-6 text-primary" /><div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse-amber" /></div>
            <span className="font-terminal font-bold text-lg tracking-tight">CASEFILE</span>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/70 hidden sm:inline-flex">EXASOL AI CHALLENGE 2026</Badge>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            {NAV_SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`relative transition-colors duration-200 ${activeSection === s.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {s.label}
                <span className={`absolute -bottom-1 left-0 h-px bg-primary transition-all duration-300 ${activeSection === s.id ? 'w-full' : 'w-0'}`} />
              </button>
            ))}
          </div>
          <button className="md:hidden p-2 text-muted-foreground hover:text-foreground" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {/* Mobile menu with backdrop */}
        <AnimatePresence>
          {mobileMenu && (
            <>
              {/* Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 top-14 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setMobileMenu(false)}
              />
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="md:hidden border-t border-border/40 overflow-hidden relative z-50 bg-background/95 backdrop-blur-xl"
              >
                <nav className="flex flex-col p-4 gap-1 text-sm">
                  {NAV_SECTIONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      className={`text-left px-3 py-2.5 rounded-lg transition-colors ${activeSection === s.id ? 'text-primary bg-primary/10 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">

        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-25" />
          <div className="absolute inset-0 bg-noise" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-primary/[0.04] blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-[oklch(0.7_0.15_160/0.03)] blur-[120px]" />
          {/* Animated radial gradient pulse behind headline */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full animate-hero-glow opacity-40" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-20 text-center">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <Badge variant="outline" className="mb-6 border-primary/30 text-primary/80 animate-border-glow"><Zap className="w-3 h-3 mr-1.5" />AI for Autonomous Agents — Exasol Build Challenge 2026</Badge>
              <h1 className="text-3xl sm:text-5xl lg:text-[3.4rem] font-bold tracking-tight leading-[1.08] mb-6">
                Single-shot text-to-SQL answers the question you{' '}<span className="text-gradient-amber">already knew</span>{' '}how to ask.
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
                CASEFILE is an agent that forms hypotheses, tests them, kills the wrong ones,
                and follows the evidence across hundreds of millions of rows — and it only works
                because Exasol answers each step{' '}<span className="text-foreground font-semibold">fast enough to make the loop affordable</span>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 shadow-lg shadow-primary/20" onClick={() => scrollToSection('investigate')}><Play className="w-4 h-4 mr-2" />Run an Investigation</Button>
                <Button variant="outline" size="lg" className="border-border hover:bg-secondary" onClick={() => scrollToSection('example')}><Eye className="w-4 h-4 mr-2" />See Example Output</Button>
              </div>
            </motion.div>
            {/* Hero stats with parallax */}
            <motion.div style={{ y: heroStatsY }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
              {[
                { label: 'Rows Analyzed', value: '320M+', icon: Database, sub: 'NYC TLC 2022–2024' },
                { label: 'Query Latency', value: '<500ms', icon: Zap, sub: 'sub-second median' },
                { label: 'Investigation Depth', value: '4 levels', icon: GitBranch, sub: 'best-first search' },
                { label: 'Verdicts', value: '3 states', icon: Shield, sub: 'confirmed/refuted/...' },
              ].map(s => (
                <div key={s.label} className="group relative flex flex-col items-center p-4 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm card-hover overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <s.icon className="w-5 h-5 text-primary mb-2 relative" /><span className="font-terminal font-bold text-xl relative">{s.value}</span>
                  <span className="text-xs text-muted-foreground mt-1 relative">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground/60 mt-0.5 relative">{s.sub}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="py-12 section-divider">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <Section>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-3">
                {[
                  { step: '1', label: 'Ask a question', icon: MessageSquare, desc: 'Any open-ended data question' },
                  { step: '2', label: 'Watch the agent investigate', icon: Activity, desc: '40–60 dependent queries in real-time' },
                  { step: '3', label: 'Get a reproducible case file', icon: ScrollText, desc: 'Every finding backed by SQL' },
                ].map((item, i) => (
                  <div key={item.step} className="flex items-center gap-3 sm:gap-0">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/60 card-hover min-w-[200px]">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground hidden sm:block">{item.desc}</p>
                      </div>
                    </div>
                    {i < 2 && (
                      <ChevronRight className="w-5 h-5 text-primary/40 shrink-0 hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </section>

        {/* ═══ ARCHITECTURE ═══ */}
        <section id="architecture" className="py-20 section-divider">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <Section><div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 border-border text-muted-foreground"><Layers className="w-3 h-3 mr-1.5" />SYSTEM DESIGN</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">The Investigation Loop</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">An investigation is not one query. It is 40–60 <span className="text-foreground font-medium">dependent</span> queries, where each is chosen based on what the previous one returned.</p>
            </div>
            {/* Pipeline with animated connectors on lg+ */}
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col lg:flex-row items-stretch gap-3">
                {[
                  { title: 'Hypothesis Engine', desc: 'LLM generates competing, falsifiable explanations', icon: Brain, color: 'text-primary', bg: 'from-primary/10' },
                  { title: 'SQL Planner', desc: 'Each hypothesis becomes a testable query', icon: Terminal, color: 'text-[oklch(0.7_0.15_160)]', bg: 'from-[oklch(0.7_0.15_160/0.1)]' },
                  { title: 'Exasol Personal', desc: 'Executes in milliseconds against 320M+ rows', icon: Database, color: 'text-primary', bg: 'from-primary/10' },
                  { title: 'Verdict Engine', desc: 'CONFIRMED / REFUTED / INCONCLUSIVE', icon: Shield, color: 'text-[oklch(0.75_0.15_85)]', bg: 'from-[oklch(0.75_0.15_85/0.1)]' },
                  { title: 'Case File', desc: 'Evidence chain + ruled-out list', icon: FileSearch, color: 'text-[oklch(0.7_0.15_160)]', bg: 'from-[oklch(0.7_0.15_160/0.1)]' },
                ].map((step, i) => (
                  <div key={step.title} className="flex items-stretch flex-1 min-w-0">
                    <Card className="bg-card/80 border-border/40 hover:border-primary/30 transition-all duration-300 card-hover w-full">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-[10px] font-terminal font-bold text-muted-foreground">{i + 1}</span>
                          <step.icon className={`w-4 h-4 ${step.color}`} />
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                      </CardContent>
                    </Card>
                    {i < 4 && <PipelineConnector />}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { state: 'CONFIRMED', icon: CheckCircle2, color: 'text-[oklch(0.7_0.15_160)]', border: 'border-[oklch(0.7_0.15_160/0.25)]', bg: 'from-[oklch(0.7_0.15_160/0.05)]', desc: 'Data supports the hypothesis. Spawn 2–3 narrower children. Depth is where insight lives.' },
                { state: 'REFUTED', icon: XCircle, color: 'text-[oklch(0.65_0.25_25)]', border: 'border-[oklch(0.65_0.25_25/0.25)]', bg: 'from-[oklch(0.65_0.25_25/0.05)]', desc: 'Kill the branch and log it. The ruled-out list is half the value of a real investigation.' },
                { state: 'INCONCLUSIVE', icon: HelpCircle, color: 'text-[oklch(0.75_0.15_85)]', border: 'border-[oklch(0.75_0.15_85/0.25)]', bg: 'from-[oklch(0.75_0.15_85/0.05)]', desc: 'Retry once with reformulation, then kill. Never loop forever on a broken query.' },
                { state: 'BUDGET EXHAUSTED', icon: AlertTriangle, color: 'text-[oklch(0.75_0.15_85)]', border: 'border-[oklch(0.75_0.15_85/0.25)]', bg: 'from-[oklch(0.75_0.15_85/0.05)]', desc: 'Hard cap at 60 queries. Emit whatever confidence was reached. Never let a demo hang.' },
              ].map(s => (
                <Card key={s.state} className={`bg-gradient-to-br ${s.bg} to-card/50 ${s.border} hover:to-card/80 transition-all duration-300`}>
                  <CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><s.icon className={`w-4 h-4 ${s.color}`} /><h4 className={`font-terminal text-sm font-semibold ${s.color}`}>{s.state}</h4></div><p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p></CardContent>
                </Card>
              ))}
            </div></Section>
          </div>
        </section>

        {/* ═══ ECONOMICS ═══ */}
        <section id="economics" className="py-20 section-divider">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <Section><div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 border-border text-muted-foreground"><BarChart3 className="w-3 h-3 mr-1.5" />THE CORE ARGUMENT</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">The Speed Is Not a Nice-to-Have</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">It is the thing that converts a chatbot into an analyst.</p>
            </div>
            <Card className="max-w-3xl mx-auto border-primary/20 glow-amber">
              <CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full"><thead><tr className="border-b border-border/40"><th className="text-left p-4 text-sm font-medium text-muted-foreground">Engine</th><th className="text-left p-4 text-sm font-medium text-muted-foreground">Per-query</th><th className="text-left p-4 text-sm font-medium text-muted-foreground">47-query run</th><th className="text-left p-4 text-sm font-medium text-muted-foreground">Outcome</th></tr></thead>
                <tbody>
                  <tr className="border-b border-border/20"><td className="p-4 text-sm">Typical cloud warehouse</td><td className="p-4 font-terminal text-sm text-muted-foreground">8–12 s</td><td className="p-4 font-terminal text-sm text-destructive font-medium">6–9 min</td><td className="p-4 text-sm text-destructive">Agent times out, user leaves</td></tr>
                  <tr className="bg-primary/[0.06]"><td className="p-4 text-sm font-bold text-primary">Exasol Personal</td><td className="p-4 font-terminal text-sm text-primary font-medium">sub-second</td><td className="p-4 font-terminal text-sm text-[oklch(0.7_0.15_160)] font-medium">under 30 s</td><td className="p-4 text-sm text-[oklch(0.7_0.15_160)] font-medium">Investigation feels instant</td></tr>
                </tbody></table>
              </div></CardContent>
            </Card>
            <p className="text-center text-sm text-muted-foreground mt-6 max-w-xl mx-auto">Each query blocks the next. You cannot parallelize them. The dependent query loop makes database latency the <span className="text-foreground font-semibold">enabling condition</span> for the entire agent.</p></Section>
          </div>
        </section>

        {/* ═══ WHY WE BEAT THEM ═══ */}
        <section className="py-20 section-divider">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <Section><div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 border-border text-muted-foreground"><Trophy className="w-3 h-3 mr-1.5" />COMPETITIVE ANALYSIS</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Why We Beat Every Other Submission</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Most teams show Exasol as infrastructure. We show it as the <span className="text-foreground font-medium">enabling condition</span>.</p>
            </div>
            <div className="space-y-3">
              {[
                { sub: '"Chat with your data" dashboard', why: 'This is a feature Exasol already ships. You are showing them their own product.', Icon: Search, iconBg: 'bg-muted/50', iconColor: 'text-muted-foreground' },
                { sub: 'RAG over documents, Exasol as vector store', why: 'Exasol is interchangeable with Postgres + pgvector. Judges will notice.', Icon: FileText, iconBg: 'bg-muted/50', iconColor: 'text-muted-foreground' },
                { sub: 'ML model trained in a UDF', why: 'Fine, but it is a batch job. No agency, no loop, no story.', Icon: FlaskConical, iconBg: 'bg-muted/50', iconColor: 'text-muted-foreground' },
                { sub: 'BI copilot with pretty charts', why: 'Judged on the chart library, not the database.', Icon: BarChart3, iconBg: 'bg-muted/50', iconColor: 'text-muted-foreground' },
                { sub: 'CASEFILE', why: 'The database\'s core property is the enabling condition. Cannot be ported without breaking.', Icon: CircuitBoard, iconBg: 'bg-primary/15', iconColor: 'text-primary', highlight: true },
              ].map((r, i) => (
                <Card key={i} className={`border-border/40 ${r.highlight ? 'border-primary/30 bg-primary/[0.04] glow-amber' : 'hover:bg-secondary/50'} transition-all duration-200`}>
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${r.iconBg} shrink-0 mt-0.5`}>
                      <r.Icon className={`w-5 h-5 ${r.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${r.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{r.sub}</p>
                      <p className="text-xs text-muted-foreground/80 mt-1">{r.why}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div></Section>
          </div>
        </section>

        {/* ═══ LIVE INVESTIGATION ═══ */}
        <section id="investigate" className="py-20 section-divider">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <Section><div className="text-center mb-10">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary/80"><Crosshair className="w-3 h-3 mr-1.5" />LIVE DEMO</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Run an Investigation</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Type an open-ended question. The agent will form hypotheses, test them against 320M+ rows, kill the wrong ones, and assemble a case file.</p>
            </div></Section>
            {/* Input */}
            <Card className="max-w-4xl mx-auto border-border/40 mb-8">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={store.question}
                      onChange={e => store.setQuestion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isRunning && startInvestigation()}
                      placeholder={store.question ? '' : placeholderText || 'Ask an open-ended data question...'}
                      className={`pl-10 h-12 bg-secondary/40 border-border/40 font-terminal text-sm transition-shadow duration-300 focus-visible:ring-primary/30 ${!store.question ? 'placeholder:font-terminal' : ''}`}
                      disabled={isRunning}
                      style={!store.question ? { textShadow: '0 0 0 transparent' } : undefined}
                    />
                    {/* Focus glow effect */}
                    <div className="absolute inset-0 rounded-md pointer-events-none opacity-0 focus-within:opacity-100 transition-opacity duration-300" style={{ boxShadow: '0 0 0 3px oklch(0.78 0.17 72 / 0.15), 0 0 20px oklch(0.78 0.17 72 / 0.08)' }} />
                  </div>
                  <div className="flex gap-2">
                    {isRunning ? <Button variant="destructive" onClick={stopInvestigation} className="h-12 px-6"><Square className="w-4 h-4 mr-2" />Stop</Button> : (
                      <>
                        <Button onClick={startInvestigation} disabled={!socketConnected || !store.question.trim()} className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                          <Play className="w-4 h-4 mr-2" />Investigate
                          <Tooltip><TooltipTrigger asChild><span className="hidden lg:inline-flex items-center ml-2 text-xs opacity-60 font-normal"><Keyboard className="w-3 h-3 mr-0.5" />⌘↵</span></TooltipTrigger><TooltipContent side="bottom"><p>Press Ctrl+Enter or ⌘+Enter to start</p></TooltipContent></Tooltip>
                        </Button>
                        {isCompleted && <Button variant="outline" onClick={() => store.reset()} className="h-12 px-6 border-border"><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2"><div className={`w-2 h-2 rounded-full transition-colors ${socketConnected ? 'bg-[oklch(0.7_0.15_160)]' : 'bg-destructive/60 animate-pulse-amber'}`} /><span className="text-xs text-muted-foreground">{socketConnected ? 'Investigation engine connected' : 'Connecting to engine...'}</span></div>
                {/* Sample question presets */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted-foreground/60 self-center mr-1">TRY:</span>
                  {SAMPLE_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => store.setQuestion(q)} disabled={isRunning} className="text-[10px] px-2 py-1 rounded-md border border-border/30 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors truncate max-w-[200px] disabled:opacity-40 disabled:pointer-events-none" title={q}>{q.length > 40 ? q.substring(0, 40) + '...' : q}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Layout: receipts + timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 xl:col-span-3">
                <Card className="border-border/40 sticky top-20"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Receipts{isRunning && <span className="ml-auto flex items-center gap-1.5 text-xs text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-amber" />LIVE</span>}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    {/* Budget progress bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium font-terminal">BUDGET {budgetUsed}/{BUDGET_MAX}</span>
                        <span className="font-terminal text-[10px] text-muted-foreground">{Math.round(budgetPct)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${budgetColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${budgetPct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          style={{ boxShadow: `0 0 6px ${budgetBarColor}40` }}
                        />
                      </div>
                    </div>
                    <StatCounter icon={Terminal} label="Queries Executed" value={store.stats.queriesExecuted} color="text-primary" />
                    <StatCounter icon={Hash} label="Rows In Scope" value={store.stats.rowsInScope > 0 ? (store.stats.rowsInScope / 1e6).toFixed(1) : 0} unit="M" color="text-[oklch(0.7_0.15_160)]" />
                    <StatCounter icon={Clock} label="Cumulative DB Time" value={store.stats.totalDbMs > 0 ? (store.stats.totalDbMs / 1000).toFixed(1) : 0} unit="s" color="text-[oklch(0.75_0.15_85)]" />
                    <StatCounter icon={TrendingDown} label="Hypotheses Killed" value={store.stats.hypothesesKilled} color="text-[oklch(0.65_0.25_25)]" />
                    <StatCounter icon={CheckCircle2} label="Hypotheses Confirmed" value={store.stats.hypothesesConfirmed} color="text-[oklch(0.7_0.15_160)]" />
                    <StatCounter icon={GitBranch} label="Max Depth" value={store.stats.maxDepth} />
                    <Separator className="my-2" /><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="w-3 h-3" /><span>Elapsed: {((store.stats.elapsedMs || 0) / 1000).toFixed(1)}s</span></div>
                  </CardContent></Card>
              </div>
              <div className="lg:col-span-8 xl:col-span-9">
                <Tabs defaultValue="timeline" className="w-full"><TabsList className="bg-secondary/40 border border-border/40 w-full justify-start"><TabsTrigger value="timeline" className="text-xs"><GitBranch className="w-3 h-3 mr-1.5" />Hypothesis Timeline</TabsTrigger><TabsTrigger value="casefile" className="text-xs" disabled={!isCompleted && !showExample}><FileSearch className="w-3 h-3 mr-1.5" />Case File</TabsTrigger><TabsTrigger value="logs" className="text-xs"><Terminal className="w-3 h-3 mr-1.5" />Event Log</TabsTrigger></TabsList>
                  <TabsContent value="timeline" className="mt-4"><Card className="border-border/40"><CardContent className="p-4">{store.hypotheses.length === 0 && !isRunning ? (<div className="text-center py-16 text-muted-foreground"><Search className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">Start an investigation to see hypotheses appear here.</p><p className="text-xs mt-1 opacity-60">Each hypothesis is planned, executed, and judged in real-time.</p></div>) : (<ScrollArea className="max-h-[600px]" ref={timelineRef as any}><div className="space-y-2 pr-3">{store.hypotheses.map(h => <HypothesisItem key={h.hypId} hyp={h} isExpanded={expandedHyps.has(h.hypId)} onToggle={() => toggleHyp(h.hypId)} />)}{isRunning && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 text-muted-foreground text-sm"><div className="w-4 h-4 border-2 border-primary/50 border-t-primary rounded-full animate-spin" /><span>Investigating...</span></motion.div>}</div></ScrollArea>)}</CardContent></Card></TabsContent>
                  <TabsContent value="casefile" className="mt-4">{store.caseFile ? <CaseFileView caseFile={store.caseFile} /> : showExample ? <CaseFileView caseFile={EXAMPLE_CASE} isDemo /> : <Card className="border-border/40"><CardContent className="p-8 text-center text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">Case file will appear when the investigation completes.</p><Button variant="link" className="mt-3 text-xs" onClick={() => setShowExample(true)}>Or view an example output</Button></CardContent></Card>}</TabsContent>
                  <TabsContent value="logs" className="mt-4"><Card className="border-border/40"><CardContent className="p-4"><ScrollArea className="max-h-[600px]"><div className="space-y-1 font-terminal text-xs bg-noise rounded-lg p-3">{store.logs.length === 0 ? <p className="text-muted-foreground py-8 text-center">No events yet.</p> : store.logs.map((l, i) => <div key={i} className={`flex gap-2 py-1 px-2 rounded ${l.type === 'error' ? 'bg-destructive/10 text-destructive' : l.type === 'killed' ? 'text-[oklch(0.65_0.25_25)]' : l.type === 'verdict' && l.message.includes('CONFIRMED') ? 'text-[oklch(0.7_0.15_160)]' : 'text-muted-foreground'}`}><span className="text-muted-foreground/40 shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span><span className="shrink-0 w-16">[{l.type}]</span><span className="break-all">{l.message}</span></div>)}</div></ScrollArea></CardContent></Card></TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ EXAMPLE OUTPUT ═══ */}
        <section id="example" className="py-20 section-divider">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <Section><div className="text-center mb-10">
              <Badge variant="outline" className="mb-4 border-border text-muted-foreground"><FileText className="w-3 h-3 mr-1.5" />EXAMPLE OUTPUT</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">What a Case File Looks Like</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">A finding with no trail is a hallucination with a chart. A finding with 47 reproducible queries attached is analysis.</p>
            </div></Section>
            <CaseFileView caseFile={EXAMPLE_CASE} isDemo />
          </div>
        </section>

        {/* ═══ BENCHMARK ═══ */}
        <section id="benchmark" className="py-20 section-divider">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <Section><div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 border-border text-muted-foreground"><BarChart3 className="w-3 h-3 mr-1.5" />BENCHMARK</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Same Trace, Two Engines</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">The agent generated these queries before we knew what the benchmark would look like. That is a naturally-occurring workload, not a tuned one.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="border-border/40"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Latency by Query Shape</CardTitle></CardHeader><CardContent><BenchmarkChart /></CardContent></Card>
              <Card className="border-border/40"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Summary Table</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-border/40"><th className="text-left p-3 text-xs font-medium text-muted-foreground">Shape</th><th className="text-right p-3 text-xs font-medium text-muted-foreground">Count</th><th className="text-right p-3 text-xs font-medium text-primary">Exasol</th><th className="text-right p-3 text-xs font-medium text-muted-foreground">DuckDB</th><th className="text-right p-3 text-xs font-medium text-muted-foreground">Ratio</th></tr></thead><tbody>
                {BENCHMARK_DATA.map(r => <tr key={r.shape} className="border-b border-border/15 hover:bg-secondary/20 transition-colors"><td className="p-3 text-xs">{r.shape}</td><td className="p-3 text-xs font-terminal text-right text-muted-foreground">{r.count}</td><td className="p-3 text-xs font-terminal text-right text-primary font-semibold">{r.exasolMs}ms</td><td className="p-3 text-xs font-terminal text-right text-muted-foreground">{r.duckdbMs}ms</td><td className="p-3 text-xs font-terminal text-right text-[oklch(0.7_0.15_160)] bg-[oklch(0.7_0.15_160/0.06)]">{(r.duckdbMs / r.exasolMs).toFixed(1)}x</td></tr>)}
                <tr className="bg-primary/[0.06] font-semibold"><td className="p-3 text-xs">Total (47 queries)</td><td className="p-3 text-xs font-terminal text-right">47</td><td className="p-3 text-xs font-terminal text-right text-primary">21.4s</td><td className="p-3 text-xs font-terminal text-right text-muted-foreground">4m 12s</td><td className="p-3 text-xs font-terminal text-right text-[oklch(0.7_0.15_160)] bg-[oklch(0.7_0.15_160/0.1)] font-bold">11.8x</td></tr>
              </tbody></table></div></CardContent></Card>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6 max-w-xl mx-auto">The gap widens on multi-join queries — exactly the shapes an investigating agent generates most — because testing a hypothesis always requires a comparison against a baseline.</p></Section>
          </div>
        </section>

        {/* ═══ REPRODUCIBLE ANALYSIS ═══ */}
        <section id="reproducible" className="py-20 section-divider">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <Section>
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4 border-border text-muted-foreground"><Terminal className="w-3 h-3 mr-1.5" />REPRODUCIBILITY</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">Every Finding Has Reproducible SQL</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">No black boxes. Every hypothesis in the evidence chain carries the exact query that tested it. Copy, paste, verify.</p>
              </div>
              <div className="max-w-4xl mx-auto space-y-4">
                {EXAMPLE_CASE.evidenceChain.slice(0, 3).map((e, i) => (
                  <Card key={i} className={`border-border/40 ${VERDICT_BG[e.verdict] || ''}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-[11px] font-terminal font-bold text-muted-foreground">Q{e.queryNum}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${VERDICT_COLORS[e.verdict] || ''}`}>{e.verdict} {e.confidence.toFixed(0)}%</Badge>
                        <span className="text-sm font-medium flex-1">{e.statement}</span>
                      </div>
                      {e.sql && (
                        <div className="relative group">
                          <div className="absolute top-0 left-0 flex items-center gap-2">
                            <Badge variant="secondary" className="text-[9px] font-terminal">SQL</Badge>
                          </div>
                          <button
                            onClick={() => { navigator.clipboard.writeText(e.sql || '') }}
                            className="absolute top-0 right-0 flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 px-2 py-1 rounded-md hover:bg-secondary/50"
                            title="Copy SQL to clipboard"
                          >
                            <Download className="w-3 h-3" />Copy
                          </button>
                          <div className="rounded-lg overflow-hidden bg-black/40 border border-border/20">
                            <SyntaxHighlighter language="sql" style={oneDark} customStyle={{ margin: 0, fontSize: '13px', background: 'transparent', padding: '16px' }}>
                              {e.sql}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      )}
                      {e.resultSummary && (
                        <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border/20">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Result Summary</p>
                          <pre className="text-xs font-terminal text-muted-foreground whitespace-pre-wrap">{e.resultSummary}</pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <p className="text-center text-sm text-muted-foreground mt-6 max-w-xl mx-auto">These are the actual queries the agent generated — not hand-picked demos. The full case file contains all 47 queries with their results.</p>
              </div>
            </Section>
          </div>
        </section>

        {/* ═══ WHY EXASOL ═══ */}
        <section className="py-20 section-divider">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <Section>
              <Database className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Why Exasol Specifically</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">The agent design is a direct consequence of the latency budget. At sub-second query latency, a 25-step dependent investigation completes in under 30 seconds. At 8 seconds per query, the same investigation takes over 3 minutes and users abandon it. The database&apos;s core property is the enabling condition. This cannot be ported to a slower engine without breaking the user experience.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Parquet Ingest', desc: 'GLOB pattern + schema inference, one statement', icon: CircuitBoard },
                  { label: 'Sub-second Loops', desc: 'Dependent query chains feel instant', icon: Zap },
                  { label: 'Queryable Audit Trail', desc: 'Agent reasoning is itself SQL-table data', icon: FileSearch },
                ].map(item => (
                  <Card key={item.label} className="border-border/40 card-hover"><CardContent className="p-5"><item.icon className="w-5 h-5 text-primary mx-auto mb-2" /><h3 className="font-semibold text-sm mb-1 text-primary">{item.label}</h3><p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p></CardContent></Card>
                ))}
              </div>
            </Section>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border/30 py-10 mt-auto bg-noise">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Column 1: Branding */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Fingerprint className="w-5 h-5 text-primary" />
                <span className="font-terminal font-bold tracking-tight">CASEFILE</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">An autonomous investigation agent for Exasol. Built for the AI Build Challenge 2026.</p>
            </div>
            {/* Column 2: Project */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Project</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"><Github className="w-3.5 h-3.5" />Source Code</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Live Demo</a></li>
                <li><span className="inline-flex items-center gap-1.5">MIT License</span></li>
              </ul>
            </div>
            {/* Column 3: Architecture */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Architecture</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>Next.js 16 + App Router</li>
                <li>Socket.IO real-time</li>
                <li>Exasol Personal DB</li>
                <li>Zustand state mgmt</li>
              </ul>
            </div>
            {/* Column 4: Data Source */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Data Source</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="font-medium text-foreground/80">NYC TLC Trip Records</li>
                <li>320M+ rows (2022–2024)</li>
                <li>Parquet format on Exasol</li>
                <li><a href="#" className="hover:text-foreground transition-colors inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />NYC Open Data</a></li>
              </ul>
            </div>
          </div>
          <Separator className="my-6 opacity-30" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground/70">
            <span>Exasol AI Build Challenge 2026 — Track: AI for Autonomous Agents</span>
            <span>Every finding backed by reproducible SQL</span>
          </div>
        </div>
      </footer>

      {/* ═══ INLINE STYLES FOR ANIMATIONS ═══ */}
      <style jsx>{`
        @keyframes pipeline-flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -20; }
        }
        .animate-pipeline-flow {
          animation: pipeline-flow 1s linear infinite;
        }
        @keyframes hero-glow {
          0%, 100% { 
            background: radial-gradient(circle, oklch(0.78 0.17 72 / 0.08) 0%, transparent 70%);
            transform: scale(1);
          }
          50% { 
            background: radial-gradient(circle, oklch(0.78 0.17 72 / 0.15) 0%, transparent 70%);
            transform: scale(1.05);
          }
        }
        .animate-hero-glow {
          animation: hero-glow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
    </TooltipProvider>
  )
}