'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GitFork,
  GitBranch,
  Scale,
  Star,
  Terminal,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { ModeToggle } from '@/components/mode-toggle'
import { Linkify } from '@/components/Linkify'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
} from 'recharts'

type RepoAnalytics = {
  repo: {
    name: string
    full_name: string
    owner: { login: string; avatar_url: string }
    html_url: string
    description: string | null
    stargazers_count: number
    forks_count: number
    open_issues_count: number
    license: { name: string } | null
    topics: string[]
    archived?: boolean
    created_at: string
    pushed_at: string
    default_branch: string
    visibility: 'public' | 'private' | 'internal'
  }
  contributorsTop: Array<{
    login: string
    avatar_url: string
    contributions: number
    html_url: string
  }>
  contributorsCount: number
  languages: Record<string, number>
  commitSeries30d: Array<{ date: string; commits: number }>
  contributorSeries30d: Record<string, Array<{ date: string; commits: number }>>
  health: { scorePercent: number; label: 'Elite' | 'Good' | 'Fair' | 'Poor'; reasons: string[] }
  warnings: string[]
}

export default function RepoDetail({
  owner,
  repoName,
}: {
  owner: string
  repoName: string
}) {
  const router = useRouter()

  const [analytics, setAnalytics] = useState<RepoAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readme, setReadme] = useState<string | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(true)
  const [readmeError, setReadmeError] = useState<string | null>(null)
  const [summaryText, setSummaryText] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryNote, setSummaryNote] = useState<string | null>(null)
  const [healthSummary, setHealthSummary] = useState('')
  const [healthSummaryLoading, setHealthSummaryLoading] = useState(true)
  const [healthSummaryNote, setHealthSummaryNote] = useState<string | null>(null)
  const [copied, setCopied] = useState<'https' | 'ssh' | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const summaryRequestRef = useRef<{ key: string | null; inFlight: boolean }>({ key: null, inFlight: false })
  const healthRequestRef = useRef<{ key: string | null; inFlight: boolean }>({ key: null, inFlight: false })

  useEffect(() => {
    let isMounted = true

    const fetchRepoAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/github/repo/${owner}/${repoName}/analytics`)
        if (!res.ok) throw new Error('Failed to fetch repository data')

        const data = (await res.json()) as RepoAnalytics
        if (!isMounted) return
        setAnalytics(data)
      } catch (err: any) {
        if (!isMounted) return
        setError(err.message)
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    const fetchReadme = async () => {
      try {
        setReadmeLoading(true)
        setReadmeError(null)
        const res = await fetch(`/api/github/repo/${owner}/${repoName}/readme`)
        if (!res.ok) throw new Error('Failed to fetch README')
        const data = (await res.json()) as { readme?: string }
        if (!isMounted) return
        setReadme(data.readme ?? '')
      } catch (err: any) {
        if (!isMounted) return
        setReadmeError(err.message)
        setReadme('')
      } finally {
        if (!isMounted) return
        setReadmeLoading(false)
      }
    }

    fetchRepoAnalytics()
    fetchReadme()
    return () => {
      isMounted = false
    }
  }, [owner, repoName])

  const repo = analytics?.repo

  const isLive = useMemo(() => {
    if (!repo) return false
    const pushedAt = new Date(repo.pushed_at).getTime()
    const days = (Date.now() - pushedAt) / (1000 * 60 * 60 * 24)
    return days <= 7
  }, [repo])

  const cloneUrls = useMemo(() => {
    if (!repo) return null
    const fullName = repo.full_name
    return {
      https: `https://github.com/${fullName}.git`,
      ssh: `git@github.com:${fullName}.git`,
    }
  }, [repo])

  const totalCommits30d = useMemo(() => {
    if (!analytics) return 0
    return analytics.commitSeries30d.reduce((sum, p) => sum + p.commits, 0)
  }, [analytics])

  const averageCommitsPerDay = useMemo(() => Math.round((totalCommits30d / 30) * 10) / 10, [totalCommits30d])

  const languageRows = useMemo(() => {
    if (!analytics) return []
    const entries = Object.entries(analytics.languages)
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0) || 1
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([language, bytes]) => ({
        language,
        bytes,
        pct: Math.round((bytes / total) * 1000) / 10,
      }))
  }, [analytics])

  const languagePalette = [
    'bg-foreground/80',
    'bg-foreground/70',
    'bg-foreground/60',
    'bg-foreground/50',
    'bg-foreground/40',
    'bg-foreground/30',
    'bg-foreground/20',
    'bg-foreground/10',
  ]

  const readmeText = useMemo(() => (readme ?? '').trim(), [readme])

  const deterministicSummary = useMemo(() => {
    if (!repo) return ''
    return buildRepoSummary({
      repo,
      readmeText,
      topLanguages: languageRows.map(row => row.language),
    })
  }, [repo, readmeText, languageRows])

  useEffect(() => {
    if (!repo || readmeLoading) return
    const requestKey = `${repo.full_name}:${readmeText.length}:${languageRows.map(row => row.language).join(',')}:${repo.stargazers_count}:${repo.forks_count}:${repo.open_issues_count}:${repo.pushed_at}`
    if (summaryRequestRef.current.inFlight) return
    if (summaryRequestRef.current.key === requestKey && summaryText) {
      setSummaryLoading(false)
      return
    }

    const run = async () => {
      try {
        summaryRequestRef.current = { key: requestKey, inFlight: true }
        setSummaryLoading(true)
        setSummaryNote(null)
        const res = await fetch('/api/ai/repo-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: repo.owner?.login ?? owner,
            repoName: repo.name,
            description: repo.description ?? '',
            readme: readmeText,
            topLanguages: languageRows.map(row => row.language),
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
            openIssues: repo.open_issues_count ?? 0,
            lastPush: repo.pushed_at ?? '',
          }),
        })

        if (!res.ok) throw new Error('Failed to generate AI summary')
        const data = (await res.json()) as { summary?: string; fallback?: boolean; message?: string }
        setSummaryText(data.summary ?? deterministicSummary)
        if (data.fallback && data.message) {
          setSummaryNote(data.message)
        }
      } catch (err: any) {
        setSummaryText(deterministicSummary)
        setSummaryNote(err?.message || 'AI summary unavailable')
      } finally {
        summaryRequestRef.current = { key: requestKey, inFlight: false }
        setSummaryLoading(false)
      }
    }

    run()
  }, [repo, owner, readmeText, languageRows, deterministicSummary, readmeLoading, summaryText])

  useEffect(() => {
    if (!analytics || !repo) return
    const requestKey = `${repo.full_name}:${analytics.health.scorePercent}:${analytics.health.label}:${analytics.health.reasons.join('|')}`
    if (healthRequestRef.current.inFlight) return
    if (healthRequestRef.current.key === requestKey && healthSummary) {
      setHealthSummaryLoading(false)
      return
    }

    const run = async () => {
      try {
        healthRequestRef.current = { key: requestKey, inFlight: true }
        setHealthSummaryLoading(true)
        setHealthSummaryNote(null)
        const res = await fetch('/api/ai/repo-health-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: repo.owner?.login ?? owner,
            repoName: repo.name,
            scorePercent: analytics.health.scorePercent,
            label: analytics.health.label,
            reasons: analytics.health.reasons,
          }),
        })

        if (!res.ok) throw new Error('Failed to generate health summary')
        const data = (await res.json()) as { summary?: string; message?: string }
        setHealthSummary(data.summary ?? '')
        if (data.message) setHealthSummaryNote(data.message)
      } catch (err: any) {
        setHealthSummary('')
        setHealthSummaryNote(err?.message || 'AI summary unavailable')
      } finally {
        healthRequestRef.current = { key: requestKey, inFlight: false }
        setHealthSummaryLoading(false)
      }
    }

    run()
  }, [analytics, repo, owner, healthSummary])

  async function copyToClipboard(kind: 'https' | 'ssh') {
    if (!cloneUrls) return
    try {
      await navigator.clipboard.writeText(cloneUrls[kind])
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1200)
    } catch {
      // ignore
    }
  }

  if (loading) return <RepoDetailSkeleton />

  if (error || !analytics || !repo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto bg-destructive/10 border border-destructive/20 rounded-full p-3 mb-4 w-fit">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-sans">Failed to load data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 font-sans">{error || 'Repository not found.'}</p>
            <Button onClick={() => router.push('/')} variant="outline" className="rounded-lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="font-sans">Go back</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 space-y-4">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <ModeToggle className="h-8 w-8" />
        </div>

        {/* 2:1 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Left (2x) */}
          <div className="md:col-span-1 lg:col-span-2 space-y-4">
            {/* Repo header */}
            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/dashboard/${repo.owner?.login ?? owner}`} className="shrink-0">
                      <img
                        src={repo.owner?.avatar_url}
                        alt={repo.owner?.login ?? owner}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-border/30"
                      />
                    </Link>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">Repository</div>
                      <div className="text-sm text-muted-foreground font-mono">{repo.full_name}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight font-mono">{repo.name}</h1>
                    <span className="inline-flex items-center gap-1.5 text-[9px] px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/40 text-secondary-foreground">
                      <span
                        className={[
                          'h-2 w-2 rounded-full',
                          isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50',
                        ].join(' ')}
                      />
                      <span className="font-sans">{isLive ? 'Live' : 'Idle'}</span>
                    </span>
                    {repo.archived && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/20 text-muted-foreground font-sans">
                        Archived
                      </span>
                    )}
                  </div>

                  <p className="text-muted-foreground max-w-2xl font-sans text-sm sm:text-base">
                    <Linkify text={repo.description || 'No description provided.'} />
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <MetaBadge label={repo.visibility === 'private' ? 'Private' : 'Public'} />
                    <MetaBadge label="Branch" value={repo.default_branch} icon={GitBranch} />
                    <PillBadge icon={Star} label="Stars" value={repo.stargazers_count.toLocaleString()} />
                    <PillBadge icon={GitFork} label="Forks" value={repo.forks_count.toLocaleString()} />
                    <PillBadge icon={AlertCircle} label="Open issues" value={repo.open_issues_count.toLocaleString()} />
                  </div>

                  {repo.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                      {repo.topics.map(topic => (
                        <span
                          key={topic}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/30"
                        >
                          <span className="font-mono">{topic}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {analytics.warnings.length > 0 && (
                  <div className="text-xs text-muted-foreground font-sans">
                    {analytics.warnings.map(w => (
                      <div key={w}>• {w}</div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="rounded-lg gap-2 h-8 px-3 text-xs">
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                      <span className="font-sans">View on GitHub</span>
                    </a>
                  </Button>

                  <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-lg gap-2 h-8 px-3 text-xs">
                        <GitBranch className="w-4 h-4 text-muted-foreground" />
                        <span className="font-sans">Clone</span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-48 p-1 bg-background/70 backdrop-blur border border-border/50">
                      <div className="flex flex-col">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between gap-2 px-2 py-1 text-[10px] font-sans"
                          onClick={() => copyToClipboard('https')}
                        >
                          <span className="flex items-center gap-2">
                            <Copy className="w-3.5 h-3.5" />
                            Copy HTTPS
                          </span>
                          {copied === 'https' ? <Check className="w-3.5 h-3.5" /> : <span className="text-muted-foreground">↵</span>}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between gap-2 px-2 py-1 text-[10px] font-sans"
                          onClick={() => copyToClipboard('ssh')}
                        >
                          <span className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5" />
                            Copy SSH
                          </span>
                          {copied === 'ssh' ? <Check className="w-3.5 h-3.5" /> : <span className="text-muted-foreground">↵</span>}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardHeader className="px-4 sm:px-5 py-3 border-b border-border/30">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Repository summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                {readmeLoading ? (
                  <Skeleton className="h-[140px] rounded-lg" />
                ) : readmeError ? (
                  <div className="text-xs text-muted-foreground font-sans">{readmeError}</div>
                ) : summaryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                ) : !summaryText ? (
                  <div className="text-xs text-muted-foreground font-sans">Summary unavailable.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm leading-relaxed font-sans text-foreground/90">
                      <p>{summaryText}</p>
                    </div>
                    {summaryNote && (
                      <div className="text-[10px] text-muted-foreground/80 font-sans leading-snug">{summaryNote}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top contributors */}
            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardHeader className="px-4 sm:px-5 py-3 border-b border-border/30 flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Top contributors
                </CardTitle>
                <div className="text-[10px] text-muted-foreground font-sans">Top 5 in last 30d</div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-3">
                {analytics.contributorsTop.length === 0 ? (
                  <div className="text-xs text-muted-foreground font-sans">No contributor data.</div>
                ) : (
                  analytics.contributorsTop.map((c, index) => {
                    const rankStyle = rankCardStyle(index)
                    const trend = computeTrend(analytics.contributorSeries30d[c.login] ?? [])
                    return (
                      <div key={c.login} className={rankStyle.wrapperClass}>
                        <div className={rankStyle.cardClass}>
                          {rankStyle.badge && (
                            <span className={rankStyle.badge.className}>{rankStyle.badge.label}</span>
                          )}
                          <div className="flex items-center gap-3 min-w-0">
                            <Link href={`/dashboard/${c.login}`} className="shrink-0">
                              <img src={c.avatar_url} alt={c.login} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border/30" />
                            </Link>
                            <div className="min-w-0">
                              <div className="font-sans text-[11px] truncate">{c.login}</div>
                              <div className="text-[10px] text-muted-foreground font-sans">
                                <span className="font-mono tabular-nums">{c.contributions}</span> commits
                              </div>
                            </div>
                          </div>

                          <TrendChip trend={trend} />
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            {/* Commit velocity */}
            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardHeader className="px-4 sm:px-5 py-3 border-b border-border/30 flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Commit velocity
                </CardTitle>
                <div className="text-[10px] text-muted-foreground font-mono tabular-nums text-right">
                  Total <span className="text-foreground">{totalCommits30d}</span> · avg/day{' '}
                  <span className="text-foreground">{averageCommitsPerDay}</span>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-3">
                {analytics.commitSeries30d.every(p => p.commits === 0) ? (
                  <div className="h-[160px] sm:h-[200px] flex items-center justify-center text-xs text-muted-foreground font-sans">
                    No commit data available.
                  </div>
                ) : (
                  <div className="relative h-[160px] sm:h-[200px]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent" />
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.commitSeries30d} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="commitsFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'var(--font-sans)' }}
                            axisLine={false}
                            tickLine={false}
                            interval={6}
                            tickMargin={10}
                            tickFormatter={(value: string) => format(new Date(value), 'MMM d')}
                          />
                        <RechartsTooltip
                          cursor={{ stroke: 'hsl(var(--border))' }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: 8,
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          labelStyle={{
                            color: 'hsl(var(--muted-foreground))',
                            fontSize: 11,
                            marginBottom: '4px',
                          }}
                          itemStyle={{ color: 'hsl(var(--foreground))', fontSize: 12 }}
                          formatter={(value: any) => [value, 'Commits']}
                          labelFormatter={(label: any, payload: any) => {
                            const data = payload?.[0]?.payload
                            if (data?.date) return format(new Date(data.date), 'MMM d, yyyy')
                            return String(label)
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="commits"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#commitsFill)"
                          fillOpacity={1}
                          activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right (1x) */}
          <div className="md:col-span-1 lg:col-span-1 space-y-4 lg:sticky lg:top-6 self-start">
            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardHeader className="px-4 sm:px-5 py-3 border-b border-border/30 flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Repo health
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold font-mono tabular-nums">{analytics.health.scorePercent}%</div>
                  <div className="text-[9px] inline-flex px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/20 font-sans">
                    {analytics.health.label}
                  </div>
                </div>

                <div className="h-0.5 w-full rounded-full overflow-hidden bg-secondary/50">
                  <div
                    className="h-full rounded-full opacity-80"
                    style={{
                      backgroundColor: scoreBarColor(analytics.health.scorePercent),
                      width: `${Math.max(0, Math.min(100, analytics.health.scorePercent))}%`,
                    }}
                  />
                </div>

                {healthSummaryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                ) : healthSummary ? (
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground/80 font-sans leading-snug">{healthSummary}</div>
                ) : (
                  <div className="text-[10px] text-muted-foreground/80 font-sans leading-snug">AI summary unavailable.</div>
                )}
                {healthSummaryNote && (
                  <div className="text-[10px] text-muted-foreground/80 font-sans leading-snug">{healthSummaryNote}</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border border-border/30 shadow-sm rounded-lg hidden lg:block">
              <CardHeader className="px-4 sm:px-5 py-3 border-b border-border/30">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-3 text-xs">
                <Stat icon={Users} label="Contributors" value={analytics.contributorsCount.toLocaleString()} />
                <Stat icon={Calendar} label="Created" value={format(new Date(repo.created_at), 'MMM d, yyyy')} />
                <Stat
                  icon={Calendar}
                  label="Last push"
                  value={formatDistanceToNow(new Date(repo.pushed_at), { addSuffix: true })}
                />
                {repo.license && <Stat icon={Scale} label="License" value={repo.license.name} />}
              </CardContent>
            </Card>

            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardHeader className="px-4 sm:px-5 py-3 border-b border-border/30">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Language distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-3">
                {languageRows.length === 0 ? (
                  <div className="text-xs text-muted-foreground font-sans">No language data.</div>
                ) : (
                  <>
                    <div className="h-2.5 w-full rounded-full overflow-hidden border border-border/30 flex">
                      {languageRows.map((row, i) => (
                        <div
                          key={row.language}
                          className={languagePalette[i % languagePalette.length]}
                          style={{ width: `${row.pct}%` }}
                          title={`${row.language} ${row.pct}%`}
                        />
                      ))}
                    </div>
                    <div className="space-y-1">
                      {languageRows.map((row, i) => (
                        <div key={row.language} className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={['h-2 w-2 rounded-sm', languagePalette[i % languagePalette.length]].join(' ')}
                            />
                            <span className="font-sans truncate">{row.language}</span>
                          </div>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {formatBytes(row.bytes)} · {row.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function PillBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/20 text-secondary-foreground">
      <Icon className="w-2.5 h-2.5 text-muted-foreground" />
      <span className="font-sans">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </span>
  )
}

const Stat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) => (
  <div className="flex items-start text-muted-foreground gap-3">
    <div className="flex items-center gap-2 basis-1/2 min-w-0">
      <Icon className="w-4 h-4 shrink-0" />
      <span className="font-sans truncate">{label}</span>
    </div>
    <span className="basis-1/2 min-w-0 font-mono text-foreground font-medium text-right tabular-nums break-words line-clamp-2 leading-snug">
      {value}
    </span>
  </div>
)

function MetaBadge({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] px-1.5 py-0.5 rounded-full border border-border/40 bg-secondary/20 text-secondary-foreground">
      {Icon && <Icon className="w-2.5 h-2.5 text-muted-foreground" />}
      <span className="font-sans">{label}</span>
      {value && <span className="font-mono tabular-nums text-foreground">{value}</span>}
    </span>
  )
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${Math.round(value * 10) / 10} ${units[unitIndex]}`
}

function computeTrend(series: Array<{ date: string; commits: number }>) {
  if (!series || series.length === 0) {
    return { direction: 'flat' as const, percent: 0, commits: 0 }
  }
  const mid = Math.floor(series.length / 2)
  const firstHalf = series.slice(0, mid)
  const secondHalf = series.slice(mid)
  const sum = (arr: Array<{ commits: number }>) => arr.reduce((acc, p) => acc + p.commits, 0)
  const prev = sum(firstHalf)
  const curr = sum(secondHalf)
  if (prev === 0 && curr === 0) return { direction: 'flat' as const, percent: 0, commits: curr }
  if (prev === 0) return { direction: 'up' as const, percent: 100, commits: curr }
  const diff = curr - prev
  const percent = Math.round((diff / prev) * 100)
  if (Math.abs(percent) < 5) return { direction: 'flat' as const, percent: Math.abs(percent), commits: curr }
  return { direction: diff > 0 ? ('up' as const) : ('down' as const), percent: Math.abs(percent), commits: curr }
}

function TrendChip({ trend }: { trend: { direction: 'up' | 'down' | 'flat'; percent: number; commits: number } }) {
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus
  const tone = trend.direction === 'up' ? 'text-emerald-500' : trend.direction === 'down' ? 'text-rose-500' : 'text-muted-foreground'
  const borderTone =
    trend.direction === 'up'
      ? 'border-emerald-500/40'
      : trend.direction === 'down'
        ? 'border-rose-500/40'
        : 'border-border/40'
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border bg-secondary/20 px-2 py-1 text-[10px] font-mono whitespace-nowrap min-w-fit',
        borderTone,
      ].join(' ')}
    >
      <Icon className={['w-3 h-3', tone].join(' ')} />
      <span className={tone}>{trend.percent}%</span>
      <span className="ml-1 text-[9px] text-muted-foreground whitespace-nowrap">{trend.commits} commits</span>
    </span>
  )
}

function buildRepoSummary(input: {
  repo: RepoAnalytics['repo']
  readmeText: string
  topLanguages: string[]
}) {
  const { repo, readmeText, topLanguages } = input
  const description = repo.description?.trim()
  const readmeSnippet = extractReadmeSnippet(readmeText)
  const topLanguage = topLanguages[0]

  const sentences: string[] = []
  if (description) {
    sentences.push(`${repo.name} is ${description}${description.endsWith('.') ? '' : '.'}`)
  } else {
    sentences.push(`${repo.name} is a ${repo.visibility === 'private' ? 'private' : 'public'} repository.`)
  }

  if (readmeSnippet) {
    sentences.push(`README highlights ${readmeSnippet}${readmeSnippet.endsWith('.') ? '' : '.'}`)
  }

  if (topLanguage) {
    sentences.push(`Primary language: ${topLanguage}.`)
  }

  return sentences.join(' ')
}

function extractReadmeSnippet(readmeText: string) {
  if (!readmeText) return ''
  const withoutCode = readmeText.replace(/```[\s\S]*?```/g, ' ')
  const withoutHeadings = withoutCode
    .split(/\r?\n/)
    .filter(line => !/^\s*#/.test(line))
    .join(' ')
  const withoutImages = withoutHeadings.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  const withoutHtml = withoutLinks.replace(/<[^>]+>/g, ' ')
  const cleaned = withoutHtml.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  const maxLength = 220
  const sentenceMatch = cleaned.match(/^(.*?[\.!?])\s/)
  const candidate = sentenceMatch ? sentenceMatch[1] : cleaned.slice(0, maxLength)
  return candidate.slice(0, maxLength).trim()
}

function scoreBarColor(scorePercent: number) {
  if (scorePercent >= 80) return '#22c55e'
  if (scorePercent >= 40) return '#f97316'
  return '#ef4444'
}

function rankCardStyle(index: number) {
  const baseCard =
    'relative flex items-center justify-between gap-3 px-2 py-1.5 rounded-[7px] border border-border/30 bg-secondary/10 hover:bg-secondary/20 transition-colors'

  const defaultStyle = {
    wrapperClass: '',
    cardClass: baseCard,
    badge: null as null | { label: string; className: string },
  }

  if (index === 0) {
    return {
      wrapperClass: '',
      cardClass: `${baseCard} border-amber-400/60`,
      badge: {
        label: '1',
        className:
          'absolute -left-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-[10px] font-mono font-semibold text-amber-900 shadow-sm',
      },
    }
  }

  if (index === 1) {
    return {
      wrapperClass: '',
      cardClass: baseCard,
      badge: {
        label: '2',
        className:
          'absolute -left-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-[10px] font-mono font-semibold text-slate-700 shadow-sm',
      },
    }
  }

  if (index === 2) {
    return {
      wrapperClass: '',
      cardClass: `${baseCard} border-amber-500/60`,
      badge: {
        label: '3',
        className:
          'absolute -left-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-mono font-semibold text-amber-900 shadow-sm',
      },
    }
  }

  return defaultStyle
}


function RepoDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="flex items-center justify-between pb-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        <Skeleton className="h-[170px] rounded-lg" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-[190px] rounded-lg" />
            <Skeleton className="h-[160px] rounded-lg" />
            <Skeleton className="h-[120px] rounded-lg" />
            <Skeleton className="h-[260px] rounded-lg" />
            <Skeleton className="h-[280px] rounded-lg" />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <Skeleton className="h-[140px] rounded-lg" />
            <Skeleton className="h-[180px] rounded-lg hidden lg:block" />
            <Skeleton className="h-[210px] rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
