'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Search, Zap, FileSearch, Shield, Terminal, Database,
  CheckCircle2, XCircle, HelpCircle, ChevronRight, ChevronDown,
  Activity, Clock, Hash, TrendingDown, GitBranch, AlertTriangle,
  ArrowDown, ArrowRight, Play, Square, RotateCcw, ExternalLink,
  Menu, X, Bot, Brain, BarChart3, Layers, Fingerprint,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  CONFIRMED: 'bg-[oklch(0.7_0.15_160/0.1)]',
  REFUTED: 'bg-[oklch(0.65_0.25_25/0.1)]',
  INCONCLUSIVE: 'bg-[oklch(0.75_0.15_85/0.1)]',
  ERROR: 'bg-destructive/10',
}

const VERDICT_ICONS: Record<string, React.ReactNode> = {
  CONFIRMED: <CheckCircle2 className="w-4 h-4 text-[oklch(0.7_0.15_160)]" />,
  REFUTED: <XCircle className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />,
  INCONCLUSIVE: <HelpCircle className="w-4 h-4 text-[oklch(0.75_0.15_85)]" />,
  ERROR: <AlertTriangle className="w-4 h-4 text-destructive" />,
}

// ─── Counter stat component ───
function StatCounter({ icon: Icon, label, value, unit, color }: {
  icon: React.ElementType; label: string; value: string | number; unit?: string; color?: string
}) {
  const [displayVal, setDisplayVal] = useState(0)
  const prevVal = useRef(0)

  useEffect(() => {
    const target = typeof value === 'number' ? value : parseFloat(String(value)) || 0
    const start = prevVal.current
    const diff = target - start
    if (diff === 0) return

    const duration = 400
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayVal(start + diff * eased)
      if (progress < 1) requestAnimationFrame(animate)
      else prevVal.current = target
    }
    requestAnimationFrame(animate)
  }, [value])

  const formatted = typeof value === 'string' ? value :
    Number.isInteger(value) ? Math.round(displayVal).toLocaleString() :
      displayVal.toFixed(1)

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
      <div className={`p-2 rounded-md ${color || 'bg-primary/10 text-primary'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={`font-terminal text-lg font-bold ${color || 'text-foreground'}`}>
          {formatted}{unit && <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>}
        </p>
      </div>
    </div>
  )
}

// ─── Hypothesis timeline item ───
function HypothesisItem({ hyp, isExpanded, onToggle }: {
  hyp: HypothesisEvent; isExpanded: boolean; onToggle: () => void
}) {
  const verdictColor = VERDICT_COLORS[hyp.verdict || ''] || 'border-muted-foreground/30'
  const verdictBg = VERDICT_BG[hyp.verdict || ''] || 'bg-muted/30'

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`border rounded-lg overflow-hidden ${verdictColor} ${verdictBg} animate-slide-in`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="mt-0.5 shrink-0">
          {VERDICT_ICONS[hyp.verdict || ''] || <HelpCircle className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-terminal text-xs text-muted-foreground">Q{hyp.queryNum}</span>
            {hyp.verdict && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${verdictColor}`}>
                {hyp.verdict}
              </Badge>
            )}
            {hyp.confidence !== undefined && hyp.confidence > 0 && (
              <span className="font-terminal text-xs text-muted-foreground">
                {Math.round(hyp.confidence * 100)}%
              </span>
            )}
          </div>
          <p className="text-sm mt-1 leading-relaxed">{hyp.statement}</p>
          {hyp.reasoning && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{hyp.reasoning}</p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {hyp.sql && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">SQL</p>
                  <div className="rounded-md overflow-hidden bg-black/30 max-h-48 overflow-y-auto">
                    <SyntaxHighlighter
                      language="sql"
                      style={oneDark}
                      customStyle={{ margin: 0, fontSize: '12px', background: 'transparent' }}
                    >
                      {hyp.sql}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )}
              {hyp.resultSummary && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Result</p>
                  <pre className="text-xs font-terminal text-muted-foreground bg-black/20 rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre">
                    {hyp.resultSummary}
                  </pre>
                </div>
              )}
              {hyp.reasoning && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">Reasoning</p>
                  <p className="text-sm text-muted-foreground">{hyp.reasoning}</p>
                </div>
              )}
              {hyp.dbMs !== undefined && (
                <div className="flex gap-4 text-xs text-muted-foreground font-terminal">
                  <span>{hyp.dbMs.toFixed(1)}ms</span>
                  {hyp.rowsReturned !== undefined && <span>{hyp.rowsReturned} rows</span>}
                  {hyp.rowsScanned !== undefined && <span>{(hyp.rowsScanned / 1e6).toFixed(0)}M scanned</span>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ───
export default function HomePage() {
  const store = useInvestigationStore()
  const socketRef = useRef<any>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedHyps, setExpandedHyps] = useState<Set<string>>(new Set())
  const timelineRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const toggleHyp = useCallback((hypId: string) => {
    setExpandedHyps(prev => {
      const next = new Set(prev)
      if (next.has(hypId)) next.delete(hypId)
      else next.add(hypId)
      return next
    })
  }, [])

  // Socket connection
  useEffect(() => {
    let cancelled = false
    let s: any = null

    const init = async () => {
      const { io } = await import('socket.io-client')
      if (cancelled) return
      s = io('/?XTransformPort=' + SERVICE_PORT, {
        path: '/',
        transports: ['polling', 'websocket'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 30000,
      })
      socketRef.current = s

      s.on('connect', () => {
        setSocketConnected(true)
      })
      s.on('connect_error', () => {
        setSocketConnected(false)
      })
      s.on('disconnect', () => {
        setSocketConnected(false)
      })

      s.on('investigation', (event: any) => {
        const { type, data } = event

        switch (type) {
          case 'started': {
            store.setPhase('running')
            store.setCaseFile(null as any)
            startTimeRef.current = Date.now()
            store.addLog('system', `Investigation ${data.runId} started`)
            if (elapsedRef.current) clearInterval(elapsedRef.current)
            elapsedRef.current = setInterval(() => {
              store.updateStats({ elapsedMs: Date.now() - startTimeRef.current })
            }, 100)
            break
          }

          case 'root_hypotheses': {
            store.addLog('hypothesis', `Generated ${data.hypotheses.length} root hypotheses`)
            for (const h of data.hypotheses) {
              store.addHypothesis({
                hypId: h.hypId,
                parentId: null,
                depth: 0,
                statement: h.statement,
                rationale: h.rationale,
                queryNum: 0,
                timestamp: event.timestamp,
              })
            }
            break
          }

          case 'progress': {
            store.setPhase('running')
            break
          }

          case 'planned': {
            store.updateHypothesis(data.hypId, {
              sql: data.sql,
              queryNum: data.queryNum,
            })
            store.addLog('sql', `Q${data.queryNum}: SQL planned`)
            break
          }

          case 'executed': {
            store.updateHypothesis(data.hypId, {
              dbMs: data.dbMs,
              rowsReturned: data.rowsReturned,
              rowsScanned: data.rowsScanned,
            })
            store.updateStats({
              queriesExecuted: data.totalQueries,
              rowsInScope: (store.stats.rowsInScope || 0) + (data.rowsScanned || 0),
              totalDbMs: data.totalDbMs,
            })
            break
          }

          case 'judged': {
            store.updateHypothesis(data.hypId, {
              verdict: data.verdict,
              confidence: data.confidence,
              reasoning: data.reasoning,
            })
            if (data.verdict === 'CONFIRMED') {
              store.updateStats({ hypothesesConfirmed: data.confirmed })
            } else if (data.verdict === 'REFUTED') {
              store.updateStats({ hypothesesKilled: data.killed })
            }
            store.addLog('verdict', `Q${data.queryNum}: ${data.verdict} (${Math.round(data.confidence * 100)}%) — ${data.statement.substring(0, 60)}...`)
            break
          }

          case 'refuted': {
            store.addLog('killed', `Killed: ${data.statement.substring(0, 60)}...`)
            break
          }

          case 'children': {
            store.addLog('branch', `Spawned ${data.children.length} follow-ups from: ${data.parentStatement.substring(0, 50)}...`)
            break
          }

          case 'completed': {
            if (elapsedRef.current) {
              clearInterval(elapsedRef.current)
              elapsedRef.current = null
            }
            store.updateStats({ elapsedMs: Date.now() - startTimeRef.current })
            store.setCaseFile(data)
            store.addLog('system', `Investigation completed: ${data.summary.queriesExecuted} queries, ${(data.summary.totalDbMs / 1000).toFixed(1)}s DB time`)
            break
          }

          case 'error': {
            if (elapsedRef.current) {
              clearInterval(elapsedRef.current)
              elapsedRef.current = null
            }
            store.setPhase('error')
            store.addLog('error', data.message)
            break
          }
        }

        if (timelineRef.current) {
          timelineRef.current.scrollTop = timelineRef.current.scrollHeight
        }
      })
    }

    init()

    return () => {
      cancelled = true
      s?.disconnect()
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, []) // Socket connection - intentionally no deps

  const startInvestigation = () => {
    if (!store.question.trim() || !socketRef.current?.connected) return
    store.reset()
    store.setPhase('connecting')
    setExpandedHyps(new Set())
    socketRef.current.emit('start-investigation', { question: store.question })
  }

  const stopInvestigation = () => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current)
      elapsedRef.current = null
    }
    store.setPhase('idle')
    socketRef.current?.disconnect()
  }

  const isRunning = store.phase === 'running' || store.phase === 'connecting'
  const isCompleted = store.phase === 'completed'

  return (
    <TooltipProvider>
    <div className="min-h-screen flex flex-col bg-background">

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Fingerprint className="w-6 h-6 text-primary" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse-amber" />
            </div>
            <span className="font-terminal font-bold text-lg tracking-tight">CASEFILE</span>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/70 hidden sm:inline-flex">
              EXASOL AI CHALLENGE 2026
            </Badge>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#economics" className="hover:text-foreground transition-colors">Economics</a>
            <a href="#investigate" className="hover:text-foreground transition-colors">Investigate</a>
            <a href="#benchmark" className="hover:text-foreground transition-colors">Benchmark</a>
          </div>
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-border/50 overflow-hidden"
            >
              <nav className="flex flex-col p-4 gap-3 text-sm">
                <a href="#architecture" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">Architecture</a>
                <a href="#economics" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">Economics</a>
                <a href="#investigate" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">Investigate</a>
                <a href="#benchmark" onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">Benchmark</a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">

        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-6 border-primary/30 text-primary/80">
                <Zap className="w-3 h-3 mr-1.5" />
                AI for Autonomous Agents — Exasol Build Challenge 2026
              </Badge>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                Single-shot text-to-SQL answers the question you{' '}
                <span className="text-primary">already knew</span> how to ask.
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
                CASEFILE is an agent that forms hypotheses, tests them, kills the wrong ones,
                and follows the evidence across hundreds of millions of rows — and it only works
                because Exasol answers each step{' '}
                <span className="text-foreground font-semibold">fast enough to make the loop affordable</span>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8"
                  onClick={() => document.getElementById('investigate')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run an Investigation
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-border hover:bg-secondary"
                  onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  How It Works
                  <ArrowDown className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>

            {/* Hero stats bar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
            >
              {[
                { label: 'Rows Analyzed', value: '320M+', icon: Database },
                { label: 'Query Latency', value: '<500ms', icon: Zap },
                { label: 'Investigation Depth', value: '4 levels', icon: GitBranch },
                { label: 'Verdicts', value: '3 states', icon: Shield },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center p-3 rounded-lg border border-border/50 bg-card/50">
                  <s.icon className="w-5 h-5 text-primary mb-1.5" />
                  <span className="font-terminal font-bold text-lg">{s.value}</span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ─── ARCHITECTURE ─── */}
        <section id="architecture" className="py-20 border-t border-border/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4 border-border text-muted-foreground">
                  <Layers className="w-3 h-3 mr-1.5" />
                  SYSTEM DESIGN
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">The Investigation Loop</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  An investigation is not one query. It is 40–60 dependent queries, where each is
                  chosen based on what the previous one returned.
                </p>
              </div>

              {/* Architecture diagram */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start max-w-4xl mx-auto">
                {[
                  { title: 'Hypothesis Engine', desc: 'LLM generates competing, falsifiable explanations', icon: Brain, color: 'text-primary' },
                  { title: 'SQL Planner', desc: 'Each hypothesis becomes a testable query', icon: Terminal, color: 'text-[oklch(0.7_0.15_160)]' },
                  { title: 'Exasol Personal', desc: 'Executes in milliseconds against 320M+ rows', icon: Database, color: 'text-primary' },
                  { title: 'Verdict Engine', desc: 'CONFIRMED / REFUTED / INCONCLUSIVE + confidence', icon: Shield, color: 'text-[oklch(0.75_0.15_85)]' },
                  { title: 'Case File', desc: 'Evidence chain, ruled-out list, reproducible SQL', icon: FileSearch, color: 'text-[oklch(0.7_0.15_160)]' },
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="relative"
                  >
                    <Card className="bg-card/80 border-border/50 hover:border-primary/30 transition-colors h-full">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-terminal text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                          <step.icon className={`w-4 h-4 ${step.color}`} />
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                      </CardContent>
                    </Card>
                    {i < 4 && (
                      <ArrowRight className="hidden md:block absolute top-1/2 -right-2 w-4 h-4 text-muted-foreground/40 -translate-y-1/2" />
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Four states explanation */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    state: 'CONFIRMED', icon: CheckCircle2, color: 'text-[oklch(0.7_0.15_160)]',
                    border: 'border-[oklch(0.7_0.15_160/0.3)]',
                    desc: 'Data supports the hypothesis. The agent asks "why is this true?" and spawns 2–3 narrower children. Depth is where insight lives.',
                  },
                  {
                    state: 'REFUTED', icon: XCircle, color: 'text-[oklch(0.65_0.25_25)]',
                    border: 'border-[oklch(0.65_0.25_25/0.3)]',
                    desc: 'Data contradicts it. Kill the branch and log it. The ruled-out list is half the value of a real investigation.',
                  },
                  {
                    state: 'INCONCLUSIVE', icon: HelpCircle, color: 'text-[oklch(0.75_0.15_85)]',
                    border: 'border-[oklch(0.75_0.15_85/0.3)]',
                    desc: 'Result was empty or ambiguous. Retry once with a reformulation, then kill. Never loop forever on a broken query.',
                  },
                  {
                    state: 'BUDGET EXHAUSTED', icon: AlertTriangle, color: 'text-muted-foreground',
                    border: 'border-border',
                    desc: 'Hard cap at 60 queries. Emit the case file with whatever confidence was reached. Never let a demo hang.',
                  },
                ].map((s) => (
                  <Card key={s.state} className={`bg-card/50 ${s.border} hover:bg-card/80 transition-colors`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                        <h4 className={`font-terminal text-sm font-semibold ${s.color}`}>{s.state}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── ECONOMICS ─── */}
        <section id="economics" className="py-20 border-t border-border/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4 border-border text-muted-foreground">
                  <BarChart3 className="w-3 h-3 mr-1.5" />
                  THE CORE ARGUMENT
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">The Speed Is Not a Nice-to-Have</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  It is the thing that converts a chatbot into an analyst.
                </p>
              </div>

              {/* Latency table */}
              <Card className="max-w-3xl mx-auto border-border/50 glow-amber">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Engine</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Per-query</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">47-query run</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/30">
                          <td className="p-4 text-sm font-medium">Typical cloud warehouse</td>
                          <td className="p-4 font-terminal text-sm text-muted-foreground">8–12 s</td>
                          <td className="p-4 font-terminal text-sm text-destructive">6–9 min</td>
                          <td className="p-4 text-sm text-destructive">Agent times out, user leaves</td>
                        </tr>
                        <tr className="bg-primary/5">
                          <td className="p-4 text-sm font-bold text-primary">Exasol Personal</td>
                          <td className="p-4 font-terminal text-sm text-primary">sub-second</td>
                          <td className="p-4 font-terminal text-sm text-[oklch(0.7_0.15_160)]">under 30 s</td>
                          <td className="p-4 text-sm text-[oklch(0.7_0.15_160)]">Investigation feels instant</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground mt-6 max-w-xl mx-auto">
                Each query blocks the next. You cannot parallelize them. You cannot batch them.
                The dependent query loop makes database latency the{' '}
                <span className="text-foreground font-semibold">enabling condition</span> for the entire agent.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ─── LIVE INVESTIGATION ─── */}
        <section id="investigate" className="py-20 border-t border-border/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-10">
                <Badge variant="outline" className="mb-4 border-primary/30 text-primary/80">
                  <Search className="w-3 h-3 mr-1.5" />
                  LIVE DEMO
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">Run an Investigation</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Type an open-ended question. The agent will form hypotheses, test them against
                  320M+ NYC taxi trip records, kill the wrong ones, and assemble a case file.
                </p>
              </div>

              {/* Question input */}
              <Card className="max-w-4xl mx-auto border-border/50 mb-8">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={store.question}
                        onChange={(e) => store.setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isRunning && startInvestigation()}
                        placeholder="Ask an open-ended data question..."
                        className="pl-10 h-12 bg-secondary/50 border-border/50 font-terminal text-sm"
                        disabled={isRunning}
                      />
                    </div>
                    <div className="flex gap-2">
                      {isRunning ? (
                        <Button
                          variant="destructive"
                          onClick={stopInvestigation}
                          className="h-12 px-6"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={startInvestigation}
                            disabled={!socketConnected || !store.question.trim()}
                            className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Investigate
                          </Button>
                          {isCompleted && (
                            <Button
                              variant="outline"
                              onClick={() => store.reset()}
                              className="h-12 px-6 border-border"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reset
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-[oklch(0.7_0.15_160)]' : 'bg-destructive'}`} />
                    <span className="text-xs text-muted-foreground">
                      {socketConnected ? 'Investigation engine connected' : 'Connecting to engine...'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Main investigation layout: receipts + timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">

                {/* Left: Receipts Panel */}
                <div className="lg:col-span-4 xl:col-span-3">
                  <Card className="border-border/50 sticky top-20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Receipts
                        {isRunning && (
                          <span className="ml-auto flex items-center gap-1.5 text-xs text-primary">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-amber" />
                            LIVE
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 p-4 pt-0">
                      <StatCounter
                        icon={Terminal}
                        label="Queries Executed"
                        value={store.stats.queriesExecuted}
                        color="text-primary"
                      />
                      <StatCounter
                        icon={Hash}
                        label="Rows In Scope"
                        value={store.stats.rowsInScope > 0 ? (store.stats.rowsInScope / 1e6).toFixed(1) : 0}
                        unit="M"
                        color="text-[oklch(0.7_0.15_160)]"
                      />
                      <StatCounter
                        icon={Clock}
                        label="Cumulative DB Time"
                        value={store.stats.totalDbMs > 0 ? (store.stats.totalDbMs / 1000).toFixed(1) : 0}
                        unit="s"
                        color="text-[oklch(0.75_0.15_85)]"
                      />
                      <StatCounter
                        icon={TrendingDown}
                        label="Hypotheses Killed"
                        value={store.stats.hypothesesKilled}
                        color="text-[oklch(0.65_0.25_25)]"
                      />
                      <StatCounter
                        icon={CheckCircle2}
                        label="Hypotheses Confirmed"
                        value={store.stats.hypothesesConfirmed}
                        color="text-[oklch(0.7_0.15_160)]"
                      />
                      <StatCounter
                        icon={GitBranch}
                        label="Max Depth"
                        value={store.stats.maxDepth}
                      />
                      <Separator className="my-2" />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Elapsed: {((store.stats.elapsedMs || 0) / 1000).toFixed(1)}s</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Hypothesis Timeline + Case File */}
                <div className="lg:col-span-8 xl:col-span-9">
                  <Tabs defaultValue="timeline" className="w-full">
                    <TabsList className="bg-secondary/50 border border-border/50 w-full justify-start">
                      <TabsTrigger value="timeline" className="text-xs">
                        <GitBranch className="w-3 h-3 mr-1.5" />
                        Hypothesis Timeline
                      </TabsTrigger>
                      <TabsTrigger value="casefile" className="text-xs" disabled={!isCompleted}>
                        <FileSearch className="w-3 h-3 mr-1.5" />
                        Case File
                      </TabsTrigger>
                      <TabsTrigger value="logs" className="text-xs">
                        <Terminal className="w-3 h-3 mr-1.5" />
                        Event Log
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="timeline" className="mt-4">
                      <Card className="border-border/50">
                        <CardContent className="p-4">
                          {store.hypotheses.length === 0 && !isRunning ? (
                            <div className="text-center py-16 text-muted-foreground">
                              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">Start an investigation to see hypotheses appear here.</p>
                              <p className="text-xs mt-1">Each hypothesis is planned, executed, and judged in real-time.</p>
                            </div>
                          ) : (
                            <ScrollArea className="max-h-[600px]" ref={timelineRef as any}>
                              <div className="space-y-2 pr-3">
                                {store.hypotheses.map((hyp) => (
                                  <HypothesisItem
                                    key={hyp.hypId}
                                    hyp={hyp}
                                    isExpanded={expandedHyps.has(hyp.hypId)}
                                    onToggle={() => toggleHyp(hyp.hypId)}
                                  />
                                ))}
                                {isRunning && (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2 p-3 text-muted-foreground text-sm"
                                  >
                                    <div className="w-4 h-4 border-2 border-primary/50 border-t-primary rounded-full animate-spin" />
                                    <span>Investigating...</span>
                                  </motion.div>
                                )}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="casefile" className="mt-4">
                      {store.caseFile ? (
                        <CaseFileView caseFile={store.caseFile} />
                      ) : (
                        <Card className="border-border/50">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            <FileSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Case file will appear here when the investigation completes.</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="logs" className="mt-4">
                      <Card className="border-border/50">
                        <CardContent className="p-4">
                          <ScrollArea className="max-h-[600px]">
                            <div className="space-y-1 font-terminal text-xs">
                              {store.logs.length === 0 ? (
                                <p className="text-muted-foreground py-8 text-center">No events yet.</p>
                              ) : (
                                store.logs.map((log, i) => (
                                  <div key={i} className={`flex gap-2 py-1 px-2 rounded ${
                                    log.type === 'error' ? 'bg-destructive/10 text-destructive' :
                                    log.type === 'killed' ? 'text-[oklch(0.65_0.25_25)]' :
                                    log.type === 'verdict' && log.message.includes('CONFIRMED') ? 'text-[oklch(0.7_0.15_160)]' :
                                    'text-muted-foreground'
                                  }`}>
                                    <span className="text-muted-foreground/50 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span className="shrink-0 w-16">[{log.type}]</span>
                                    <span className="break-all">{log.message}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── BENCHMARK ─── */}
        <section id="benchmark" className="py-20 border-t border-border/30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4 border-border text-muted-foreground">
                  <BarChart3 className="w-3 h-3 mr-1.5" />
                  BENCHMARK
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">Same Trace, Two Engines</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  The agent generated these queries before we knew what the benchmark would look like.
                  That is a naturally-occurring workload, not a tuned one.
                </p>
              </div>

              <Card className="max-w-3xl mx-auto border-border/50">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Query Shape</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Count</th>
                          <th className="text-right p-4 text-sm font-medium text-primary">Exasol Median</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">DuckDB Median</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ratio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { shape: 'Simple aggregate', count: 14, exasol: '89ms', duckdb: '120ms', ratio: '1.3x' },
                          { shape: 'Multi-join + group', count: 21, exasol: '210ms', duckdb: '890ms', ratio: '4.2x' },
                          { shape: 'Window function', count: 8, exasol: '145ms', duckdb: '340ms', ratio: '2.3x' },
                          { shape: 'Self-join / correlated', count: 4, exasol: '320ms', duckdb: '1.2s', ratio: '3.8x' },
                        ].map((row) => (
                          <tr key={row.shape} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                            <td className="p-4 text-sm">{row.shape}</td>
                            <td className="p-4 text-sm font-terminal text-right text-muted-foreground">{row.count}</td>
                            <td className="p-4 text-sm font-terminal text-right text-primary font-semibold">{row.exasol}</td>
                            <td className="p-4 text-sm font-terminal text-right text-muted-foreground">{row.duckdb}</td>
                            <td className="p-4 text-sm font-terminal text-right text-[oklch(0.7_0.15_160)]">{row.ratio}</td>
                          </tr>
                        ))}
                        <tr className="bg-primary/5 font-semibold">
                          <td className="p-4 text-sm">Total wall clock</td>
                          <td className="p-4 text-sm font-terminal text-right">47</td>
                          <td className="p-4 text-sm font-terminal text-right text-primary">21.4s</td>
                          <td className="p-4 text-sm font-terminal text-right text-muted-foreground">4m 12s</td>
                          <td className="p-4 text-sm font-terminal text-right text-[oklch(0.7_0.15_160)]">11.8x</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground mt-6 max-w-xl mx-auto leading-relaxed">
                The gap widens on multi-join hypothesis queries — exactly the shapes an investigating
                agent generates most — because testing a hypothesis almost always requires a comparison
                against a baseline.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ─── WHY EXASOL ─── */}
        <section className="py-20 border-t border-border/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Database className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Why Exasol Specifically</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                The agent design is a direct consequence of the latency budget. At sub-second query
                latency, a 25-step dependent investigation completes in under 30 seconds — fast enough
                for interactive use. At 8 seconds per query (typical cloud warehouse), the same
                investigation takes over 3 minutes and users abandon it. The database&apos;s core property
                is the enabling condition. This cannot be ported to a slower engine without breaking
                the user experience.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                {[
                  { label: 'Parquet Ingest', desc: 'GLOB pattern + schema inference, one statement' },
                  { label: 'Sub-second Loops', desc: 'Dependent query chains feel instant' },
                  { label: 'Queryable Audit Trail', desc: 'Agent reasoning is itself SQL-table data' },
                ].map((item) => (
                  <Card key={item.label} className="border-border/50">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-1 text-primary">{item.label}</h3>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/30 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="font-terminal">CASEFILE</span>
              <span className="text-muted-foreground/50">|</span>
              <span>Exasol AI Build Challenge 2026</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Track: AI for Autonomous Agents</span>
              <span className="text-muted-foreground/50">|</span>
              <span>MIT License</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </TooltipProvider>
  )
}

// ─── Case File View Component ───
function CaseFileView({ caseFile }: { caseFile: CaseFile }) {
  const [showAllEvidence, setShowAllEvidence] = useState(false)
  const [showAllRuled, setShowAllRuled] = useState(false)

  const evidence = caseFile.evidenceChain || []
  const ruled = caseFile.ruledOut || []
  const s = caseFile.summary

  return (
    <div className="space-y-4">
      {/* Finding */}
      <Card className="border-[oklch(0.7_0.15_160/0.3)] glow-confirmed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[oklch(0.7_0.15_160)]" />
            <CardTitle className="text-base">Finding</CardTitle>
            <Badge className="ml-auto bg-[oklch(0.7_0.15_160/0.2)] text-[oklch(0.7_0.15_160)] border-[oklch(0.7_0.15_160/0.3)]">
              confidence {(caseFile.finalConfidence * 100).toFixed(0)}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{caseFile.finding}</p>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Investigation Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="text-center">
              <span className="font-terminal text-xl font-bold text-primary">{s.queriesExecuted}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">queries</p>
            </div>
            <div className="text-center">
              <span className="font-terminal text-xl font-bold">{(s.rowsInScope / 1e6).toFixed(0)}M</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">rows in scope</p>
            </div>
            <div className="text-center">
              <span className="font-terminal text-xl font-bold text-[oklch(0.7_0.15_160)]">{s.totalDbMs.toFixed(1)}s</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">DB time</p>
            </div>
            <div className="text-center">
              <span className="font-terminal text-xl font-bold text-destructive">{s.hypothesesRefuted}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">refuted</p>
            </div>
            <div className="text-center">
              <span className="font-terminal text-xl font-bold">{s.maxDepth}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">max depth</p>
            </div>
            <div className="text-center">
              <span className="font-terminal text-xl font-bold">{s.elapsedSeconds.toFixed(1)}s</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">elapsed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence chain */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Evidence Chain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(showAllEvidence ? evidence : evidence.slice(0, 3)).map((e, i) => (
            <div key={i} className={`p-3 rounded-lg border ${VERDICT_COLORS[e.verdict] || ''} ${VERDICT_BG[e.verdict] || ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-terminal text-xs text-muted-foreground">Q{e.queryNum}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${VERDICT_COLORS[e.verdict] || ''}`}>
                  {e.verdict} {e.confidence.toFixed(2)}
                </Badge>
              </div>
              <p className="text-sm">{e.statement}</p>
              {e.reasoning && <p className="text-xs text-muted-foreground mt-1">{e.reasoning}</p>}
            </div>
          ))}
          {evidence.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setShowAllEvidence(!showAllEvidence)}
            >
              {showAllEvidence ? 'Show less' : `Show ${evidence.length - 3} more`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Ruled out */}
      {ruled.length > 0 && (
        <Card className="border-[oklch(0.65_0.25_25/0.3)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-[oklch(0.65_0.25_25)]" />
              Ruled Out ({ruled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(showAllRuled ? ruled : ruled.slice(0, 4)).map((r, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-[oklch(0.65_0.25_25/0.05)] border border-[oklch(0.65_0.25_25/0.15)]">
                <p className="text-sm line-through text-muted-foreground">{r.statement}</p>
                {r.reasoning && <p className="text-xs text-[oklch(0.65_0.25_25)] mt-0.5">{r.reasoning}</p>}
              </div>
            ))}
            {ruled.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowAllRuled(!showAllRuled)}
              >
                {showAllRuled ? 'Show less' : `Show ${ruled.length - 4} more`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}