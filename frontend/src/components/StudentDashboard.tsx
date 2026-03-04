import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { authFetch } from '../utils/authFetch';
import { toast } from 'sonner';
import { StudentLayout } from './student/StudentLayout';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from './ui/chart';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';
import {
    FolderOpen,
    Sparkles,
    Loader2,
    TrendingUp,
    ChevronRight,
    ListFilter,
    Plus,
    AlertTriangle,
} from 'lucide-react';

/* ───────────── Types ───────────── */

type DashboardStats = {
    total_projects: number;
    completed_projects: number;
    in_progress_projects: number;
    total_xp: number;
    current_streak: number;
    skills_count: number;
    tasks_completed: number;
};

type ProjectInfo = {
    id: string;
    title: string;
    brief: string;
    progress: number;
    tasks_completed: number;
    tasks_total: number;
    vm_type: string;
    estimated_hours: number;
    xp_reward: number;
    created_at: string;
    completed_at?: string;
    xp_earned?: number;
    skills?: string[];
    source_assignment_id?: string | null;
    classroom_name?: string | null;
    is_unstarted_assignment?: boolean;
    assignment_id?: string | null;
};

type XPHistoryItem = { date: string; xp: number };

type WeakConcept = {
    concept: string;
    struggle_count: number;
    mastery_count: number;
    last_task_number: string | null;
    project_name: string | null;
    last_seen_at: string;
    last_source: string | null;
    summary: string | null;
};

type DashboardData = {
    stats: DashboardStats;
    in_progress_projects: ProjectInfo[];
    completed_projects: ProjectInfo[];
    xp_history: XPHistoryItem[];
    concepts: string[];
    weak_concepts: WeakConcept[];
};

type Props = {
    user: User;
    onBack: () => void;
    onSelectProject: (project: any) => void;
    onLogout: () => void;
};

const chartConfig = {
    xp: { label: 'XP Earned', color: '#0d9488' },
} satisfies ChartConfig;

/* ───────────── Helpers ───────────── */

const PROJECT_EMOJIS = ['🖩', '🚀', '🪐', '📟', '📊', '🤖', '🎮', '🔬', '💻', '🛠️'];
const PROJECT_COLORS = ['#0d9488', '#d97706', '#7c3aed', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#65a30d'];

const TIPS = [
    { emoji: '💡', title: 'Tip of the Day', text: 'Break big problems into small steps. Write pseudocode before real code — it helps you think clearly!' },
    { emoji: '🎯', title: 'Tip of the Day', text: 'Read error messages carefully — they usually tell you exactly what line went wrong.' },
    { emoji: '🧪', title: 'Tip of the Day', text: 'Test your code with edge cases: empty inputs, very large numbers, and unexpected types.' },
    { emoji: '📖', title: 'Tip of the Day', text: 'Use print statements to debug. Seeing what your variables hold at each step is powerful.' },
    { emoji: '🔄', title: 'Tip of the Day', text: "Don't memorize syntax — understand the concept. You can always look up the exact code." },
];

/* ───────────── Framer Variants ───────────── */

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
    }),
};

const statPop = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: (i: number) => ({
        opacity: 1, scale: 1,
        transition: { delay: 0.3 + i * 0.08, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as const },
    }),
};

const listItem = {
    hidden: { opacity: 0, x: -12 },
    visible: (i: number) => ({
        opacity: 1, x: 0,
        transition: { delay: 0.2 + i * 0.06, duration: 0.35, ease: 'easeOut' as const },
    }),
};

/* ───────────── Large Progress Ring ───────────── */

function ProgressRing({ percent, size = 110, stroke = 10 }: { percent: number; size?: number; stroke?: number }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return (
        <svg width={size} height={size} className="-rotate-90">
            <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0d9488" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
            </defs>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
            <motion.circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
                initial={{ strokeDasharray: circ, strokeDashoffset: circ }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] as const, delay: 0.5 }}
            />
        </svg>
    );
}

/* ───────────── Weak Concepts Card ───────────── */
function WeakConceptsCard({ weakConcepts }: { weakConcepts: WeakConcept[] }) {
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    if (weakConcepts.length === 0) {
        return (
            <Card className="p-4 border-slate-100">
                <div className="flex items-center gap-1.5 mb-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <span className="font-bold text-sm text-slate-800">Focus Areas</span>
                </div>
                <div className="text-center py-4">
                    <Sparkles className="w-7 h-7 text-slate-200 mx-auto mb-1.5" />
                    <p className="text-slate-400 text-sm">No weak areas detected yet!</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 border-slate-100">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <span className="font-bold text-sm text-slate-800">Focus Areas</span>
                </div>
                <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full font-medium">
                    {weakConcepts.length} concept{weakConcepts.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div className="flex flex-col gap-2">
                {weakConcepts.slice(0, 5).map((wc, i) => {
                    const isExpanded = expandedIdx === i;
                    const intensity = Math.min(wc.struggle_count, 5);
                    const bgColors = ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c'];
                    const textColors = ['#c2410c', '#c2410c', '#9a3412', '#7c2d12', '#7c2d12'];
                    const bg = bgColors[intensity - 1] || bgColors[0];
                    const fg = textColors[intensity - 1] || textColors[0];

                    return (
                        <motion.div
                            key={wc.concept}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 * i }}
                        >
                            <button
                                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                                className="w-full text-left"
                            >
                                <div
                                    className="rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition-opacity hover:opacity-80"
                                    style={{ backgroundColor: bg }}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-semibold truncate capitalize" style={{ color: fg }}>
                                            {wc.concept}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-bold" style={{ color: fg }}>
                                            ×{wc.struggle_count}
                                        </span>
                                        <ChevronRight
                                            className="w-3 h-3 transition-transform"
                                            style={{
                                                color: fg,
                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                            }}
                                        />
                                    </div>
                                </div>
                            </button>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-1 mx-1 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                            {(wc.project_name || wc.last_task_number) && (
                                                <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 mb-1.5">
                                                    {wc.project_name && wc.last_task_number
                                                        ? `${wc.project_name} · Task ${wc.last_task_number}`
                                                        : wc.project_name || `Task ${wc.last_task_number}`}
                                                </span>
                                            )}
                                            {wc.summary ? (
                                                <p className="text-xs text-slate-600 leading-relaxed">{wc.summary}</p>
                                            ) : (
                                                <p className="text-[11px] text-slate-400 italic">More details will appear after your next submission.</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>
        </Card>
    );
}


/* ───────────── Main Component ───────────── */

export function StudentDashboard({ user, onBack, onSelectProject, onLogout }: Props) {
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed'>('in_progress');
    const [startingAssignment, setStartingAssignment] = useState<string | null>(null);
    const dashboardFetchInFlightRef = useRef(false);
    const dashboardRetryTimersRef = useRef<number[]>([]);
    const isMountedRef = useRef(true);

    const todayTip = TIPS[new Date().getDate() % TIPS.length];

    useEffect(() => {
        isMountedRef.current = true;
        fetchDashboard();
        return () => {
            isMountedRef.current = false;
            dashboardRetryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            dashboardRetryTimersRef.current = [];
        };
    }, [user.id]);

    const fetchDashboard = async (retries = 2) => {
        if (dashboardFetchInFlightRef.current) return;
        dashboardFetchInFlightRef.current = true;
        try {
            const response = await fetch(`${BACKEND_URL}/dashboard/${user.id}`, { credentials: 'include' });
            const result = await response.json();
            if (result.success) {
                if (isMountedRef.current) setData(result);
            } else if (retries > 0) {
                const timerId = window.setTimeout(() => void fetchDashboard(retries - 1), 500);
                dashboardRetryTimersRef.current.push(timerId);
            } else {
                if (isMountedRef.current) setError(result.error || 'Failed to load dashboard');
            }
        } catch (err) {
            if (retries > 0) {
                const timerId = window.setTimeout(() => void fetchDashboard(retries - 1), 500);
                dashboardRetryTimersRef.current.push(timerId);
            } else {
                console.error('Dashboard error:', err);
                if (isMountedRef.current) setError('Failed to load dashboard');
            }
        } finally {
            dashboardFetchInFlightRef.current = false;
            if (isMountedRef.current) setLoading(false);
        }
    };

    const getLevel = (xp: number) => {
        if (xp < 100) return { level: 1, title: 'Beginner', next: 100 };
        if (xp < 300) return { level: 2, title: 'Learner', next: 300 };
        if (xp < 600) return { level: 3, title: 'Explorer', next: 600 };
        if (xp < 1000) return { level: 4, title: 'Builder', next: 1000 };
        if (xp < 1500) return { level: 5, title: 'Developer', next: 1500 };
        return { level: 6, title: 'Expert', next: 2000 };
    };

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const handleStartAssignment = async (assignmentId: string) => {
        setStartingAssignment(assignmentId);
        try {
            const response = await authFetch(`/assignments/${assignmentId}/start`, { method: 'POST' });
            const data = await response.json();
            if (data.success && data.project) {
                const fullRes = await authFetch(`/progress/projects/${data.project.id}/full`);
                const fullData = await fullRes.json();
                if (fullData.success && fullData.project) {
                    onSelectProject(fullData.project);
                } else {
                    toast.error(fullData.error || 'Failed to load project');
                }
            } else {
                toast.error(data.error || 'Failed to start assignment');
            }
        } catch {
            toast.error('Failed to start assignment');
        } finally {
            setStartingAssignment(null);
        }
    };

    /* ── Content inside layout ── */
    const renderContent = () => {
        /* Loading */
        if (loading) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-teal-600 mx-auto mb-4" />
                        <p className="text-slate-600 text-base">Loading...</p>
                    </motion.div>
                </div>
            );
        }

        /* Error */
        if (error || !data) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                        <p className="text-red-600 mb-4 text-base">{error || 'Something went wrong'}</p>
                        <Button onClick={() => fetchDashboard()}>Try Again</Button>
                    </motion.div>
                </div>
            );
        }

        const { stats, in_progress_projects, completed_projects, xp_history, concepts, weak_concepts } = data;
        const levelInfo = getLevel(stats.total_xp);
        const totalTasks = in_progress_projects.reduce((a, p) => a + p.tasks_total, 0);
        const doneTasks = in_progress_projects.reduce((a, p) => a + p.tasks_completed, 0);
        const overallPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        const allProjects = [...in_progress_projects, ...completed_projects];
        const filteredProjects = filter === 'all' ? allProjects
            : filter === 'in_progress' ? in_progress_projects
                : completed_projects;

        const filterTabs = [
            { key: 'in_progress' as const, label: 'In Progress', count: in_progress_projects.length },
            { key: 'completed' as const, label: 'Completed', count: completed_projects.length },
            { key: 'all' as const, label: 'All', count: allProjects.length },
        ];

        return (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <div className="px-6 py-5 max-w-7xl mx-auto space-y-4">

                    {/* Quick Stats Top Row */}
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                {
                                    value: stats.total_projects,
                                    label: 'Projects',
                                    note: `${stats.in_progress_projects} in progress`,
                                    trend: `${stats.completed_projects} done`,
                                    progress: Math.min((stats.completed_projects / Math.max(stats.total_projects, 1)) * 100, 100),
                                    color: 'text-teal-700',
                                    barColor: 'bg-teal-600'
                                },
                                {
                                    value: stats.current_streak,
                                    label: 'Day Streak',
                                    note: stats.current_streak > 0 ? 'Keep it going' : 'Start today',
                                    trend: `${Math.max(7 - stats.current_streak, 0)} to 7d goal`,
                                    progress: Math.min((stats.current_streak / 7) * 100, 100),
                                    color: 'text-orange-700',
                                    barColor: 'bg-orange-600'
                                },
                                {
                                    value: stats.total_xp,
                                    label: 'Total XP',
                                    note: `${Math.max(levelInfo.next - stats.total_xp, 0)} to next level`,
                                    trend: `L${levelInfo.level} -> L${levelInfo.level + 1}`,
                                    progress: Math.min((stats.total_xp / levelInfo.next) * 100, 100),
                                    color: 'text-amber-700',
                                    barColor: 'bg-amber-600'
                                },
                                {
                                    value: `${stats.completed_projects}/${stats.total_projects || 0}`,
                                    label: 'Completed',
                                    note: `${overallPercent}% overall`,
                                    trend: `${totalTasks - doneTasks} pending`,
                                    progress: overallPercent,
                                    color: 'text-emerald-700',
                                    barColor: 'bg-emerald-600'
                                },
                            ].map((s, i) => (
                                <motion.div
                                    key={s.label}
                                    variants={statPop}
                                    initial="hidden"
                                    animate="visible"
                                    custom={i}
                                    className="rounded-2xl border border-slate-100 bg-white p-3"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                            <div className="text-sm font-semibold text-slate-700">{s.label}</div>
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {s.trend}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">{s.note}</p>
                                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            className={`h-full rounded-full ${s.barColor}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${s.progress}%` }}
                                            transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-12 gap-4">

                    {/* ══════ LEFT COLUMN (8 cols) — Projects ══════ */}
                    <div className="col-span-8 flex flex-col gap-4">

                        {/* Filter Tabs + Title */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
                            <Card className="p-3 border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <ListFilter className="w-4 h-4 text-teal-600" />
                                        <h2 className="font-bold text-xl text-slate-800">Projects</h2>
                                    </div>
                                    <span className="text-xs font-medium text-slate-400">
                                        {in_progress_projects.length} active • {completed_projects.length} completed
                                    </span>
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-1.5 bg-slate-100 rounded-xl p-0.5">
                                    {filterTabs.map(tab => {
                                        const isActive = filter === tab.key;
                                        return (
                                            <motion.button
                                                key={tab.key}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setFilter(tab.key)}
                                                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${isActive
                                                    ? 'bg-white text-teal-700 shadow-sm'
                                                    : 'bg-transparent text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                {tab.label}
                                                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-teal-100 text-teal-600' : 'bg-slate-200 text-slate-400'
                                                    }`}>
                                                    {tab.count}
                                                </span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </Card>
                        </motion.div>

                        {/* Project List */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={filter}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col gap-3"
                            >
                                {/* Create Project Card */}
                                <motion.div
                                    variants={listItem} initial="hidden" animate="visible" custom={0}
                                    whileHover={{ scale: 1.01, y: -2 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => navigate('/custom-project')}
                                    className="cursor-pointer"
                                >
                                    <Card className="p-4 border-slate-100 hover:shadow-md transition-shadow border-dashed">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-teal-50"
                                            >
                                                <Plus className="w-6 h-6 text-teal-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-base text-slate-800 leading-snug">Create New Project</h3>
                                                <p className="text-sm text-slate-400 mt-1 leading-relaxed">Start a new coding project from scratch</p>
                                            </div>
                                            <motion.div
                                                className="shrink-0 self-center text-slate-300"
                                                whileHover={{ x: 4 }}
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </motion.div>
                                        </div>
                                    </Card>
                                </motion.div>

                                {filteredProjects.length > 0 ? filteredProjects.map((project, i) => {
                                    const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
                                    const emoji = PROJECT_EMOJIS[i % PROJECT_EMOJIS.length];
                                    const isCompleted = project.completed_at != null;
                                    const sourceLabel = project.classroom_name
                                        ? `Class: ${project.classroom_name}`
                                        : 'Personal Project';

                                    return (
                                        <motion.div
                                            key={project.id}
                                            variants={listItem} initial="hidden" animate="visible" custom={i}
                                            whileHover={{ scale: 1.01, y: -2 }}
                                            whileTap={{ scale: 0.99 }}
                                            onClick={() => {
                                                if (project.is_unstarted_assignment && project.assignment_id) {
                                                    handleStartAssignment(project.assignment_id);
                                                } else {
                                                    onSelectProject(project);
                                                }
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <Card className="p-4 border-slate-100 hover:shadow-md transition-shadow">
                                                <div className="flex items-start gap-4">
                                                    {/* Emoji Icon */}
                                                    <div
                                                        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                                                        style={{ backgroundColor: color + '12' }}
                                                    >
                                                        {emoji}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <h3 className="font-semibold text-base text-slate-800 leading-snug">{project.title}</h3>
                                                                <span
                                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold mt-2 ${project.classroom_name
                                                                        ? 'bg-teal-100 text-teal-700'
                                                                        : 'bg-slate-100 text-slate-600'
                                                                        }`}
                                                                >
                                                                    {sourceLabel}
                                                                </span>
                                                                <p className="text-sm text-slate-400 mt-2 leading-relaxed line-clamp-2">{project.brief}</p>
                                                            </div>
                                                            {project.is_unstarted_assignment ? (
                                                                startingAssignment === project.assignment_id ? (
                                                                    <Loader2 className="w-5 h-5 animate-spin text-teal-600 shrink-0" />
                                                                ) : (
                                                                    <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0 bg-teal-600 text-white">
                                                                        Start
                                                                    </span>
                                                                )
                                                            ) : (
                                                                <span
                                                                    className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                                                                    style={{ backgroundColor: color + '12', color }}
                                                                >
                                                                    {isCompleted ? `+${project.xp_earned || project.xp_reward}` : `+${project.xp_reward}`} XP
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Progress */}
                                                        <div className="mt-3">
                                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                                <span className="font-medium text-slate-500">Progress</span>
                                                                <span className="text-sm font-semibold text-slate-600 shrink-0 tabular-nums">
                                                                    {project.is_unstarted_assignment ? 'Not started' : isCompleted ? `${project.tasks_total}/${project.tasks_total} tasks` : `${project.tasks_completed}/${project.tasks_total} tasks`}
                                                                </span>
                                                            </div>
                                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    className="h-full rounded-full"
                                                                    style={{ backgroundColor: isCompleted ? '#10b981' : color }}
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${isCompleted ? 100 : project.progress}%` }}
                                                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    );
                                }) : (
                                    <Card className="p-10 border-slate-100 text-center">
                                        <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                        <h3 className="text-base font-semibold text-slate-700 mb-1">
                                            {filter === 'completed' ? 'No completed projects yet' : 'No projects yet'}
                                        </h3>
                                        <p className="text-sm text-slate-400 mb-4">
                                            {filter === 'completed' ? 'Finish a project to see it here!' : 'Start your coding journey today!'}
                                        </p>
                                        {filter !== 'in_progress' && (
                                            <Button size="sm" onClick={() => setFilter('in_progress')}>View In Progress</Button>
                                        )}
                                        {filter === 'in_progress' && (
                                            <Button size="sm" onClick={onBack}>Browse Projects</Button>
                                        )}
                                    </Card>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* ══════ RIGHT COLUMN (4 cols) — Sidebar ══════ */}
                    <div className="col-span-4 flex flex-col gap-4">

                        {/* Profile Card */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
                            <Card className="p-5 border-slate-100">
                                <div className="flex items-center gap-3">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                                        className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-2xl font-bold text-white overflow-hidden shrink-0"
                                        style={{ boxShadow: '0 0 20px rgba(13, 148, 136, 0.25)' }}
                                    >
                                        {user.profilePictureUrl ? (
                                            <img
                                                src={user.profilePictureUrl}
                                                alt={user.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            user.name?.charAt(0)?.toUpperCase() || 'U'
                                        )}
                                    </motion.div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-lg text-slate-800 leading-tight truncate">{user.name || 'Student'}</h3>
                                        <p className="text-sm text-slate-400 mt-1">Level {levelInfo.level} • {levelInfo.title}</p>
                                    </div>
                                </div>

                                {/* XP Progress to next level */}
                                <div className="mt-3 px-1">
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                                        <span>LV{levelInfo.level}</span>
                                        <span>{stats.total_xp} / {levelInfo.next} XP</span>
                                        <span>LV{levelInfo.level + 1}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-amber-400"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min((stats.total_xp / levelInfo.next) * 100, 100)}%` }}
                                            transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    {[
                                        { value: stats.total_projects, label: 'Projects', color: '#0d9488' },
                                        { value: stats.current_streak, label: 'Streak', color: '#f59e0b' },
                                        { value: stats.total_xp, label: 'XP', color: '#7c3aed' },
                                    ].map((s, i) => (
                                        <motion.div
                                            key={s.label}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.7 + i * 0.1 }}
                                            className="bg-slate-50 rounded-xl min-h-[84px] px-2 py-2 flex flex-col items-center justify-center text-center"
                                        >
                                            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
                                        </motion.div>
                                    ))}
                                </div>
                            </Card>
                        </motion.div>

                        {/* Overall Progress */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
                            <Card className="p-4 border-slate-100 flex flex-col items-center">
                                <span className="font-bold text-base text-slate-800 mb-3 self-start">Overall Progress</span>
                                <div className="relative">
                                    <ProgressRing percent={overallPercent} />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.8, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] as const }}
                                            className="text-2xl font-bold text-slate-800 leading-none"
                                        >
                                            {overallPercent}%
                                        </motion.span>
                                        <span className="text-xs text-slate-400 mt-1">complete</span>
                                    </div>
                                </div>
                                <div className="flex gap-5 mt-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                                        <span className="text-slate-500">Done {doneTasks}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                                        <span className="text-slate-500">Pending {totalTasks - doneTasks}</span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* XP Chart */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
                            <Card className="p-4 border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-teal-600" />
                                        <span className="font-bold text-sm text-slate-800">XP History</span>
                                    </div>
                                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded font-medium">30d</span>
                                </div>
                                <div className="h-28 w-full">
                                    <ChartContainer config={chartConfig} className="h-full w-full">
                                        <BarChart data={xp_history} barCategoryGap="25%">
                                            <defs>
                                                <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.7} />
                                                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.3} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={22} />
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                            <Bar dataKey="xp" fill="url(#xpGrad)" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ChartContainer>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Tip of the Day */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
                            <Card className="p-4 border-slate-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl">{todayTip.emoji}</span>
                                    <span className="font-bold text-base text-slate-800">{todayTip.title}</span>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">{todayTip.text}</p>
                            </Card>
                        </motion.div>

                        {/* Focus Areas — weak concepts */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
                            <WeakConceptsCard weakConcepts={weak_concepts ?? []} />
                        </motion.div>

                        {/* XP Chart */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
                            <Card className="p-4 border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-teal-600" />
                                        <span className="font-bold text-sm text-slate-800">XP History</span>
                                    </div>
                                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded font-medium">30d</span>
                                </div>
                                <div className="h-28 w-full">
                                    <ChartContainer config={chartConfig} className="h-full w-full">
                                        <BarChart data={xp_history} barCategoryGap="25%">
                                            <defs>
                                                <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.7} />
                                                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.3} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={22} />
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                            <Bar dataKey="xp" fill="url(#xpGrad)" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ChartContainer>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Skills */}
                        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
                            <Card className="p-4 border-slate-100">
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <span className="font-bold text-sm text-slate-800">Skills Learned</span>
                                </div>
                                {concepts.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {concepts.map((c, i) => (
                                            <motion.span
                                                key={i}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.6 + i * 0.05 }}
                                                whileHover={{ scale: 1.1 }}
                                                className="px-2.5 py-1 rounded-full text-xs font-semibold cursor-default"
                                                style={{
                                                    backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] + '12',
                                                    color: PROJECT_COLORS[i % PROJECT_COLORS.length],
                                                }}
                                            >
                                                {c}
                                            </motion.span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <Sparkles className="w-7 h-7 text-slate-200 mx-auto mb-1.5" />
                                        <p className="text-slate-400 text-sm">Complete projects to learn skills!</p>
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    </div>
                    </div>
                    </div>

            </div>
        );
    };

    return (
        <StudentLayout user={user} onLogout={onLogout}>
            {renderContent()}
        </StudentLayout>
    );
}
