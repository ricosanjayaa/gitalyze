import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Star,
  GitFork,
  ArrowLeft,
  ExternalLink,
  Calendar,
  AlertCircle,
  Users,
  Scale,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ModeToggle } from '@/components/mode-toggle'
import { Linkify } from '@/components/Linkify'

interface RepoData {
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  html_url: string
  description: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  language: string
  license: { name: string } | null
  created_at: string
  updated_at: string
  pushed_at: string
  topics: string[]
  contributors: {
    login: string
    avatar_url: string
    contributions: number
    html_url: string
  }[]
}

export default function RepoDetail() {
  const { owner, repoName } = useParams<{ owner: string; repoName: string }>()
  const navigate = useNavigate()

  const [repoData, setRepoData] = useState<RepoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRepoData = async () => {
      try {
        setLoading(true)

        const res = await fetch(`/api/github/repo/${owner}/${repoName}`)
        if (!res.ok) throw new Error('Failed to fetch repository data')

        const data = await res.json()
        setRepoData(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRepoData()
  }, [owner, repoName])

  if (loading) return <RepoDetailSkeleton />

  if (error || !repoData) {
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
            <p className="text-muted-foreground mb-4 font-sans">
              {error || 'Repository not found.'}
            </p>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="rounded-lg"
            >
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
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6 space-y-8">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-border/30 pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <ModeToggle className="h-8 w-8" />
        </div>

        {/* Repository Header */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {repoData.name}
              </h1>
              <p className="text-muted-foreground max-w-2xl font-sans">
                <Linkify
                  text={repoData.description || 'No description provided.'}
                />
              </p>
            </div>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-lg shrink-0"
            >
              <a
                href={repoData.html_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="font-sans">View on GitHub</span>
                <ExternalLink className="w-3 h-3 ml-2" />
              </a>
            </Button>
          </div>

          {repoData.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {repoData.topics.map(topic => (
                <span
                  key={topic}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/30"
                >
                  <span className="font-mono">{topic}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">

          {/* Left Column */}
          <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-sans">
                Top contributors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {repoData.contributors.slice(0, 18).map(c => (
                  <TooltipProvider key={c.login}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to={`/dashboard/${c.login}`}>
                          <img
                            src={c.avatar_url}
                            alt={c.login}
                            className="w-10 h-10 rounded-full border-2 border-transparent hover:border-primary transition-colors"
                          />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-mono">{c.login}</p>
                        <p className="text-muted-foreground font-sans">
                          <span className="font-mono tabular-nums">{c.contributions}</span> contributions
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right Column */}
          <div className="space-y-6">

            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-sans">
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Stat icon={Star} label="Stars" value={repoData.stargazers_count.toLocaleString()} />
                <Stat icon={GitFork} label="Forks" value={repoData.forks_count.toLocaleString()} />
                <Stat icon={AlertCircle} label="Open issues" value={repoData.open_issues_count.toLocaleString()} />
                <Stat icon={Users} label="Contributors" value={repoData.contributors.length.toLocaleString()} />
                {repoData.license && (
                  <Stat icon={Scale} label="License" value={repoData.license.name} />
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border border-border/30 shadow-sm rounded-lg">
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-sans">
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Stat
                  icon={Calendar}
                  label="Created"
                  value={format(new Date(repoData.created_at), 'MMM d, yyyy')}
                />
                <Stat
                  icon={Calendar}
                  label="Last push"
                  value={formatDistanceToNow(new Date(repoData.pushed_at), {
                    addSuffix: true,
                  })}
                />
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
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
  <div className="flex items-start justify-between text-muted-foreground gap-4">
    <div className="flex items-center gap-2 shrink-0">
      <Icon className="w-4 h-4" />
      <span className="font-sans">{label}</span>
    </div>
    <span className="font-mono text-foreground font-medium text-right tabular-nums">
      {value}
    </span>
  </div>
)

function RepoDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1100px] mx-auto space-y-6">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <Skeleton className="h-56 rounded-lg" />
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}