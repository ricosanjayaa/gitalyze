import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Star, 
  GitFork, 
  MapPin, 
  ArrowLeft,
  ExternalLink,
  TrendingUp,
  Calendar,
  RefreshCw,
  AlertCircle,
  Info,
  TrendingDown,
  Minus,
  AlertTriangle
} from "lucide-react";
import { 
  AreaChart,
  Area,
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { format } from "date-fns";
import { ModeToggle } from "@/components/mode-toggle";
import { useTheme } from "@/components/theme-provider";
import { Linkify } from "@/components/Linkify";
import { SearchInput } from '@/components/SearchInput';
import { useGithubAnalytics } from '@/hooks/useGithubAnalytics';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const KpiCard = ({ title, value, grade, total }: { title: string; value: number; grade?: string; total?: number }) => {
  const gradeColor = grade?.startsWith('A') ? 'text-emerald-500' : 
                     grade?.startsWith('B') ? 'text-blue-500' : 
                     'text-yellow-500';

  return (
    <Card className="shadow-sm border-border/30 h-full">
      <CardContent className="p-3">
        <div className="flex flex-col justify-between h-full">
          <span className="text-xs text-muted-foreground font-sans">{title}</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold tracking-tight tabular-nums font-mono">
              {value?.toLocaleString() ?? '...'}
            </span>
            {grade && <span className={`text-xs font-mono font-bold ${gradeColor} tabular-nums`}>{grade}</span>}
            {total !== undefined && <span className="text-xs text-muted-foreground font-mono tabular-nums">/ {total.toLocaleString()}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const {
    user,
    loading,
    error,
    scoreData,
    recommendations,
    lastUpdated,
    loadingRecs,
    recError,
    isRecRateLimited,
    recRetryAfter,
    retryRecommendations,
    totalStars,
    totalForks,
    activeRepos,
    languageData,
    topRepos,
    growthData,
    refetch
  } = useGithubAnalytics(username);

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (isRecRateLimited) {
      const initialCountdown = typeof recRetryAfter === 'number' && recRetryAfter > 0 ? recRetryAfter : 60;
      setCountdown(initialCountdown);
    } else {
      setCountdown(null);
    }
  }, [isRecRateLimited, recRetryAfter]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Defensive: ensure recommendations is always a list before rendering
  const safeRecommendations = useMemo(() => Array.isArray(recommendations) ? recommendations : [], [recommendations]);

  const chartColors = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      textPrimary: isDark ? "#ffffff" : "#000000",
      textSecondary: isDark ? "#a0a0a0" : "#737373",
      grid: isDark ? "#333333" : "#e5e5e5",
      tooltipBg: isDark ? "#000000" : "#ffffff",
      tooltipBorder: isDark ? "#333333" : "#e5e5e5",
      chartLine: isDark ? "#ffffff" : "#000000",
      pieColors: isDark 
        ? ["#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569"] 
        : ["#475569", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"],
    };
  }, [theme]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto bg-destructive/10 border border-destructive/20 rounded-full p-3 mb-4 w-fit">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Failed to load data</CardTitle>
            <CardDescription>{error || "User not found"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} variant="outline" className="rounded-lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/10 flex flex-col overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto p-4 md:p-6 space-y-3 flex-1 w-full">
        
        {/* --- Header --- */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-2 mb-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            {/* Profile Tooltip */}
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3 cursor-default min-w-0">
                    <img src={user.avatar_url} alt={user.login} className="w-10 h-10 sm:w-8 sm:h-8 rounded-full border border-border shrink-0" />
                    <div className="min-w-0">
                      <h1 className="text-sm font-bold leading-none font-sans truncate max-w-[150px] sm:max-w-none">{user.name || user.login}</h1>
                      <a href={user.html_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline font-mono tabular-nums">@{user.login}</a>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" className="bg-popover border-border text-popover-foreground shadow-md rounded-lg p-3 max-w-[250px]">
                  <div className="space-y-2 text-xs">
                    {user.bio && (
                      <div className="flex gap-2">
                        <Info className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                        <p className="leading-tight font-sans"><Linkify text={user.bio} /></p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span className="font-sans">Joined {format(new Date(user.created_at), "MMM dd, yyyy")}</span>
                    </div>
                    {user.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="font-sans">{user.location}</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>

          </div>
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider tabular-nums">
              <span className="font-sans hidden sm:inline">Last updated </span>
              <span className="font-mono tabular-nums">{format(lastUpdated, "HH:mm")}</span>
              <RefreshCw className="w-3 h-3 opacity-50 cursor-pointer hover:opacity-100 transition-opacity" onClick={refetch} />
            </div>
            <ModeToggle className="h-8 w-8" />
          </div>
        </header>

        {/* --- Hero KPIs --- */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 items-stretch">
          <KpiCard title="Profile score" value={scoreData?.total} grade={scoreData?.grade} />
          <KpiCard title="Total stars" value={totalStars} />
          <KpiCard title="Total forks" value={totalForks} />
          <KpiCard title="Active repos" value={activeRepos} total={user.public_repos} />
          <KpiCard title="Followers" value={user.followers} />
        </div>

        {/* --- Middle Section: Top Repos & Languages --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          
          {/* Top Repositories */}
          <Card className="lg:col-span-2 bg-card border-border/30 shadow-sm rounded-lg flex flex-col">
            <CardHeader className="px-5 py-3 border-b border-border/30">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">Top repositories</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col">
              <div className="divide-y divide-border/30 flex-1">
                {topRepos.map((repo, i) => (
                  <TooltipProvider key={repo.id || i}>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Link 
                          to={`/repo/${user.login}/${repo.name}`}
                          className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start gap-4 overflow-hidden">
                            <span className="text-[10px] font-mono text-muted-foreground w-5 text-center mt-1 shrink-0">#{i + 1}</span>
                            <div className="flex flex-col min-w-0 gap-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors break-words font-mono">{repo.name}</span>
                                {repo.language && (
                                  <span className="text-[9px] px-1.5 py-px rounded-full bg-secondary text-secondary-foreground border border-border/50 shrink-0">
                                    <span className="font-mono">{repo.language}</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate opacity-80 leading-tight max-w-[450px] font-sans">
                                {repo.description || "No description"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground shrink-0 ml-4">
                            <div className="flex items-center gap-1">
                              <span className="tabular-nums font-mono">{repo.stargazers_count}</span>
                              <Star className="w-3 h-3" />
                            </div>
                            <div className="flex items-center gap-1 hidden sm:flex">
                              <span className="tabular-nums font-mono">{repo.forks_count}</span>
                              <GitFork className="w-3 h-3" />
                            </div>
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" className="bg-popover border-border text-popover-foreground shadow-md rounded-lg p-3 max-w-[300px]">
                        <div className="space-y-2 text-xs">
                          <p className="font-bold text-sm text-foreground font-mono">{repo.name}</p>
                          {repo.description && <p className="text-muted-foreground leading-tight font-sans"><Linkify text={repo.description} /></p>}
                          {!repo.description && <p className="text-muted-foreground leading-tight font-sans">No description provided.</p>}
                          <div className="flex items-center gap-2 text-muted-foreground/80 pt-1">
                            <Calendar className="w-3 h-3" />
                            <span className="font-sans">Created {format(new Date(repo.created_at), "MMM dd, yyyy")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground/80">
                            <RefreshCw className="w-3 h-3" />
                            <span className="font-sans">Updated {format(new Date(repo.updated_at), "MMM dd, yyyy")}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                ))}
                {topRepos.length === 0 && (
                  <div className="px-6 py-8 text-center text-xs text-muted-foreground font-sans">
                    No repositories found.
                  </div>
                )}
              </div>
              <a 
                href={`https://github.com/${username}?tab=repositories`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center px-6 py-4 border-t border-border/30 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors gap-1.5"
              >
                <span className="font-sans">View all repositories</span> <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>

          {/* Languages - Monotone Rounded Donut Chart */}
          <Card className="bg-card border-border/30 shadow-sm rounded-lg flex flex-col">
            <CardHeader className="px-5 py-3 border-b border-border/30">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">Languages</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 grid grid-rows-[1fr_auto] gap-4">
              {languageData.length > 0 ? (
                <>
                  <div className="relative min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={languageData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={4}
                        >
                          {languageData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={chartColors.pieColors[index % chartColors.pieColors.length]} 
                              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }}
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          cursor={{ fill: 'transparent' }}
                          wrapperStyle={{ zIndex: 100, verticalAlign: 'top' }}
                          contentStyle={{ 
                            backgroundColor: chartColors.tooltipBg, 
                            borderColor: chartColors.tooltipBorder, 
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          itemStyle={{ color: chartColors.textPrimary, fontSize: '12px' }}
                          formatter={(value: number, name: string) => {
                            const total = languageData.reduce((acc, curr) => acc + curr.value, 0);
                            const percent = Math.round((value / total) * 100);
                            return [`${value} repos (${percent}%)`, name];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                      <span className="text-3xl font-bold text-foreground tracking-tighter font-mono tabular-nums">
                        {languageData.length}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-sans">Langs</span>
                    </div>
                  </div>
                  
                  <div className="w-full mt-4 space-y-2">
                    {languageData.map((lang, i) => {
                      const total = languageData.reduce((acc, curr) => acc + curr.value, 0);
                      const percent = Math.round((lang.value / total) * 100);
                      return (
                        <div key={lang.name} className="flex items-center justify-between text-[11px] px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: chartColors.pieColors[i % chartColors.pieColors.length] }} />
                            <span className="text-muted-foreground truncate max-w-[100px] font-sans">{lang.name}</span>
                          </div>
                          <span className="font-mono font-medium text-foreground tabular-nums">{percent}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="row-span-2 flex items-center justify-center text-center text-xs text-muted-foreground py-8 font-sans">No language data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Bottom Section: Performance, Recs, Growth --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Performance Evaluation - Colored Bars */}
          <Card className="bg-card border-border/30 shadow-sm rounded-lg h-auto min-h-[320px] flex flex-col">
            <CardHeader className="px-5 py-3 border-b border-border/30">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-center">
              {scoreData && (
                [ 
                  { key: 'activity', max: 25, tip: 'Based on recent repository updates and contribution consistency.' },
                  { key: 'quality', max: 30, tip: 'Calculated from star/fork count and overall repository health.' },
                  { key: 'volume', max: 15, tip: 'Reflects the total number of public repositories.' },
                  { key: 'diversity', max: 10, tip: 'Measures the variety of programming languages used.' },
                  { key: 'completeness', max: 10, tip: 'Indicates how thoroughly your profile is filled out.' },
                  { key: 'maturity', max: 10, tip: 'Based on the age of your GitHub account.' },
                ].map(({ key, max }) => {
                  const value = scoreData[key as keyof typeof scoreData];
                  if (typeof value !== 'number') return null;
                  
                  const percentage = (value / max) * 100;
                  
                  let barColor = "#ef4444"; // Red (Low)
                  if (percentage >= 80) barColor = "#22c55e"; // Green (High)
                  else if (percentage >= 40) barColor = "#f97316"; // Orange (Medium)

                  return (
                                        <div key={key} className="space-y-1.5 group cursor-default">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="uppercase font-medium text-muted-foreground group-hover:text-foreground transition-colors tracking-wider font-sans">
                          {key}
                        </span>
                        <span className="font-mono font-bold tabular-nums" style={{ color: barColor }}>{Math.round(value)}/{max}</span>
                      </div>
                      <div className="h-0.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
                          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }} 
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Recommendations - Bullet List */}
          <Card className="bg-card border-border/30 shadow-sm rounded-lg h-auto min-h-[320px] flex flex-col">
            <CardHeader className="px-5 py-3 border-b border-border/30">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto flex flex-col">
              {loadingRecs ? (
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Generating</span>
                  </div>
                </div>
              ) : recError ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 min-h-[200px]">
                  {isRecRateLimited ? (
                    <div className="flex flex-row items-center gap-2 text-amber-500">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[10px] font-sans">
                        API limit reached, try again in {countdown ?? recRetryAfter ?? 60}s.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={retryRecommendations}
                        disabled={countdown !== null && countdown > 0}
                        className="h-6 px-2 text-[9px] font-sans shrink-0"
                      >
                        {countdown !== null && countdown > 0 ? 'Wait' : 'Retry'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-[11px] text-muted-foreground font-sans mb-1">{recError}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={retryRecommendations}
                        className="h-7 px-3 text-[10px] font-sans"
                      >
                        Try again
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <motion.ul 
                  className="space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  {safeRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-tight">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground/40 shrink-0" />
                      <span className="font-sans">{rec}</span>
                    </li>
                  ))}
                  {safeRecommendations.length === 0 && (
                    <li className="text-[11px] text-muted-foreground font-sans flex items-center justify-center h-full min-h-[200px]">
                      No specific recommendations, keep up the great work!
                    </li>
                  )}
                </motion.ul>
              )}
            </CardContent>
          </Card>

          {/* Repo Growth (Quarterly Deltas - Full Area Chart) */}
          <Card className="bg-card border-border/30 shadow-sm rounded-lg flex flex-col h-auto min-h-[320px]">
            <CardHeader className="px-5 py-3 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">Growth</CardTitle>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-mono font-bold flex items-center gap-1 tabular-nums ${
                  growthData.length > 0 && growthData[growthData.length-1].count > 0 ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {growthData.length > 0 ? `+${growthData[growthData.length-1].count} new` : '0 new'}
                  {growthData.length > 1 && (() => {
                    const last = growthData[growthData.length-1].count;
                    const prev = growthData[growthData.length-2].count;
                    const diff = last - prev;
                    const percent = prev > 0 ? Math.round((diff / prev) * 100) : (last > 0 ? 100 : 0);
                    
                    return (
                      <span className="flex items-center gap-0.5 ml-1 text-muted-foreground font-mono tabular-nums">
                        {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {Math.abs(percent)}%
                      </span>
                    );
                  })()}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">(Total {user.public_repos})</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 min-h-0 flex flex-col">
              <div className="flex-grow w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColors.chartLine} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={chartColors.chartLine} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.3} />
                    <XAxis 
                      dataKey="shortName" 
                      tick={{ fill: chartColors.textSecondary, fontSize: 10, fontFamily: 'var(--font-sans)' }} 
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                      tickMargin={8} 
                    />
                    <YAxis 
                      tick={{ fill: chartColors.textSecondary, fontSize: 10, fontFamily: 'var(--font-sans)' }} 
                      axisLine={false}
                      tickLine={false}
                      tickMargin={8}
                      width={30}
                    />
                    <Tooltip 
                      wrapperStyle={{ verticalAlign: 'top' }}
                      contentStyle={{ 
                        backgroundColor: chartColors.tooltipBg, 
                        borderColor: chartColors.tooltipBorder, 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      itemStyle={{ color: chartColors.textPrimary, fontSize: '12px' }}
                      labelStyle={{ color: chartColors.textSecondary, fontSize: '11px', marginBottom: '4px' }}
                      formatter={(value: number, name: string) => {
                        if (name === "count") return [String(value), "New Repos"];
                        return [String(value), name];
                      }}
                      labelFormatter={(label, payload) => {
                        const data = payload?.[0]?.payload;
                        if (data) return data.name;
                        return label;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke={chartColors.chartLine} 
                      strokeWidth={2} 
                      fill="url(#colorGrowth)" 
                      fillOpacity={1}
                      activeDot={{ r: 4, strokeWidth: 0, fill: chartColors.chartLine }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        </div>
        <div className="py-12 bg-background/50">
          <div className="max-w-xl mx-auto px-4">
            <h3 className="text-center text-lg font-semibold mb-4 font-sans">Analyze another profile</h3>
            <SearchInput />
          </div>
        </div>
      </div>

      {/* --- Footer --- */}
      <footer className="py-6 bg-background/50 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
          <span className="font-sans">Copyright © {new Date().getFullYear()} <a href="https://github.com/ricosanjayaa" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline transition-colors font-sans">Rico Sanjaya</a></span>
          <span className="font-sans">
            Built with <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline transition-colors font-sans">Google AI Studio</a>
          </span>
        </div>
      </footer>
    </div>
  );
}



function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 font-sans">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Skeleton className="lg:col-span-2 h-[300px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Skeleton className="h-[150px] rounded-lg" />
          <Skeleton className="h-[150px] rounded-lg" />
          <Skeleton className="h-[150px] rounded-lg" />
        </div>
      </div>
    </div>
  );
}
