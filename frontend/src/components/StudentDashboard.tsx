import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../App';
import { BACKEND_URL } from '../utils/constants';
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
    Trophy,
    Flame,
    FolderOpen,
    Sparkles,
    Loader2,
    CheckCircle2,
    TrendingUp,
    Code2,
    Home,

    BookOpen,
    Calendar,
    Award,
    Settings,
    HelpCircle,
    LogOut,
    Bell,
    Zap,
    ChevronRight,
    Clock,
    ArrowRight,
    ListFilter,
    Plus,
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
};

type XPHistoryItem = { date: string; xp: number };

type DashboardData = {
    stats: DashboardStats;
    in_progress_projects: ProjectInfo[];
    completed_projects: ProjectInfo[];
    xp_history: XPHistoryItem[];
    concepts: string[];
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

/* ───────────── Progress Ring (small) ───────────── */

function MiniRing({ percent, size = 44, stroke = 4 }: { percent: number; size?: number; stroke?: number }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return (
        <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
            <motion.circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="#0d9488" strokeWidth={stroke} strokeLinecap="round"
                initial={{ strokeDasharray: circ, strokeDashoffset: circ }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
            />
        </svg>
    );
}

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

/* ───────────── Main Component ───────────── */

export function StudentDashboard({ user, onBack, onSelectProject, onLogout }: Props) {
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeNav, setActiveNav] = useState('Home');
    const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed'>('in_progress');

    const todayTip = TIPS[new Date().getDate() % TIPS.length];

    useEffect(() => { fetchDashboard(); }, [user.id]);

    const fetchDashboard = async (retries = 2) => {
        try {
            const response = await fetch(`${BACKEND_URL}/dashboard/${user.id}`, { credentials: 'include' });
            const result = await response.json();
            if (result.success) {
                setData(result);
            } else if (retries > 0) {
                setTimeout(() => fetchDashboard(retries - 1), 500);
            } else {
                setError(result.error || 'Failed to load dashboard');
            }
        } catch (err) {
            if (retries > 0) {
                setTimeout(() => fetchDashboard(retries - 1), 500);
            } else {
                console.error('Dashboard error:', err);
                setError('Failed to load dashboard');
            }
        } finally {
            setLoading(false);
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

    const timeAgo = (dateString: string) => {
        const diff = Date.now() - new Date(dateString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    /* ── Loading ── */
    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)' }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-teal-600 mx-auto mb-4" />
                    <p className="text-slate-600 text-base">Loading...</p>
                </motion.div>
            </div>
        );
    }

    /* ── Error ── */
    if (error || !data) {
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)' }}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                    <p className="text-red-600 mb-4 text-base">{error || 'Something went wrong'}</p>
                    <Button onClick={() => fetchDashboard()}>Try Again</Button>
                </motion.div>
            </div>
        );
    }

    const { stats, in_progress_projects, completed_projects, xp_history, concepts } = data;
    const levelInfo = getLevel(stats.total_xp);
    const totalTasks = in_progress_projects.reduce((a, p) => a + p.tasks_total, 0);
    const doneTasks = in_progress_projects.reduce((a, p) => a + p.tasks_completed, 0);
    const overallPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const allProjects = [...in_progress_projects, ...completed_projects];
    const filteredProjects = filter === 'all' ? allProjects
        : filter === 'in_progress' ? in_progress_projects
            : completed_projects;

    const notifications = [
        ...in_progress_projects.slice(0, 2).map(p => ({
            title: p.title,
            message: p.progress > 0 ? `Continue where you left off — ${p.progress}% done` : 'You have a new project to start!',
            time: timeAgo(p.created_at),
            color: '#0d9488',
        })),
        ...(stats.current_streak > 0 ? [{
            title: `${stats.current_streak}-day streak! 🔥`,
            message: "You're on fire — keep it going!",
            time: 'Today',
            color: '#f59e0b',
        }] : []),
    ];

    const navItems = [
        { icon: Home, label: 'Home', action: onBack },
        { icon: BookOpen, label: 'Projects', action: () => navigate('/projects') },
        { icon: Calendar, label: 'Schedule' },
        { icon: Award, label: 'Achievements' },
    ];

    const filterTabs = [
        { key: 'in_progress' as const, label: 'In Progress', count: in_progress_projects.length },
        { key: 'completed' as const, label: 'Completed', count: completed_projects.length },
        { key: 'all' as const, label: 'All', count: allProjects.length },
    ];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)' }}>
            <style>{`
                .gradient-text {
                    background: linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .scrollbar-thin::-webkit-scrollbar { width: 4px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>

            {/* ═══════════ SIDEBAR ═══════════ */}
            <motion.nav
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-52 shrink-0 flex flex-col px-3 py-5 rounded-r-2xl bg-gradient-to-b from-teal-900/95 to-teal-950/95"
            >
                <div className="flex items-center gap-2 px-3 mb-7">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-300/90 to-teal-500/90 flex items-center justify-center">
                        <Code2 className="w-4 h-4 text-teal-950" />
                    </div>
                    <div>
                        <div className="text-white font-bold text-sm leading-tight">Edvance</div>
                        <div className="text-teal-400/70 text-xs">Learning Platform</div>
                    </div>
                </div>

                <div className="flex flex-col gap-0.5">
                    {navItems.map((item, i) => {
                        const isActive = activeNav === item.label;
                        return (
                            <motion.button
                                key={item.label}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.1 + i * 0.05 }}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => { if (isActive) return; setActiveNav(item.label); if (item.action) item.action(); }}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left border-none cursor-pointer ${isActive
                                    ? 'bg-teal-500/15 text-teal-300'
                                    : 'bg-transparent text-white/40 hover:text-white/70 hover:bg-white/5'
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </motion.button>
                        );
                    })}
                </div>

                <div className="flex-1" />

                {/* Motivation */}
                <div className="bg-white/5 rounded-xl p-4 text-center mb-5 border border-white/5">
                    <div className="text-3xl mb-1.5">🎯</div>
                    <div className="text-white text-xs font-semibold mb-0.5">Keep going!</div>
                    <div className="text-white/35 text-xs leading-relaxed">
                        {stats.completed_projects > 0
                            ? `You've completed ${stats.completed_projects} project${stats.completed_projects > 1 ? 's' : ''}!`
                            : 'Complete a project to earn your first XP'}
                    </div>
                </div>

                <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
                    {[
                        { icon: HelpCircle, label: 'Help', onClick: undefined as (() => void) | undefined },
                        { icon: Settings, label: 'Settings', onClick: undefined as (() => void) | undefined },
                        { icon: LogOut, label: 'Log Out', onClick: onLogout },
                    ].map(item => (
                        <motion.button
                            key={item.label}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={item.onClick}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/35 hover:text-white/60 hover:bg-white/5 transition-colors text-left bg-transparent border-none cursor-pointer"
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </motion.button>
                    ))}
                </div>
            </motion.nav>

            {/* ═══════════ MAIN 3-COLUMN CONTENT ═══════════ */}
            <main className="flex-1 bg-transparent rounded-2xl m-2.5 ml-0 overflow-hidden flex flex-col">

                {/* ── Header Bar ── */}
                <motion.div
                    variants={fadeUp} initial="hidden" animate="visible" custom={0}
                    className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0"
                >
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="text-slate-800">Welcome back, </span>
                            <span className="gradient-text">{user.name?.split(' ')[0]}!</span>
                            <span> 👋</span>
                        </h1>
                        <p className="text-slate-400 text-sm mt-0.5">Let's continue your coding journey</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-semibold">
                                <Flame className="w-4 h-4" />
                                {stats.current_streak} day streak
                            </div>
                            <div className="flex items-center gap-1.5 bg-teal-50 text-teal-600 px-3 py-1.5 rounded-lg font-semibold">
                                <Zap className="w-4 h-4" />
                                {stats.total_xp} XP
                            </div>
                        </div>
                        <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/profile')}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base bg-gradient-to-br from-teal-500 to-teal-600 cursor-pointer overflow-hidden"
                            style={{ boxShadow: '0 0 12px rgba(13, 148, 136, 0.3)' }}
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
                    </div>
                </motion.div>

                {/* ── 3-Column Grid ── */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <div className="grid grid-cols-12 gap-4 px-6 py-5 max-w-7xl mx-auto">

                        {/* ══════ LEFT COLUMN (3 cols) ══════ */}
                        <div className="col-span-3 flex flex-col gap-4">

                            {/* Notifications */}
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                                <Card className="p-4 border-slate-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-teal-600" />
                                            <span className="font-bold text-base text-slate-800">Notifications</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {notifications.length > 0 ? notifications.map((n, i) => (
                                            <motion.div
                                                key={i}
                                                variants={listItem} initial="hidden" animate="visible" custom={i}
                                                whileHover={{ x: 3 }}
                                                className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                                            >
                                                <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: n.color }} />
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-semibold text-sm text-slate-800 leading-snug">{n.title}</h4>
                                                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                                                    <span className="text-xs text-slate-300 mt-1 block">{n.time}</span>
                                                </div>
                                            </motion.div>
                                        )) : (
                                            <p className="text-sm text-slate-400 py-4 text-center">No new notifications</p>
                                        )}
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

                            {/* Quick Stats */}
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
                                <Card className="p-4 border-slate-100">
                                    <span className="font-bold text-base text-slate-800 mb-3 block">Quick Stats</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: stats.total_projects, label: 'Projects', emoji: '📁', bg: 'bg-teal-50', color: 'text-teal-700' },
                                            { value: stats.completed_projects, label: 'Done', emoji: '✅', bg: 'bg-emerald-50', color: 'text-emerald-700' },
                                            { value: stats.total_xp, label: 'Total XP', emoji: '⚡', bg: 'bg-amber-50', color: 'text-amber-700' },
                                            { value: stats.current_streak, label: 'Streak', emoji: '🔥', bg: 'bg-orange-50', color: 'text-orange-700' },
                                        ].map((s, i) => (
                                            <motion.div
                                                key={s.label}
                                                variants={statPop} initial="hidden" animate="visible" custom={i}
                                                whileHover={{ scale: 1.05 }}
                                                className={`${s.bg} rounded-xl p-3 text-center cursor-default`}
                                            >
                                                <div className="text-lg mb-0.5">{s.emoji}</div>
                                                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        </div>

                        {/* ══════ CENTER COLUMN (6 cols) — Projects ══════ */}
                        <div className="col-span-6 flex flex-col gap-4">

                            {/* Filter Tabs + Title */}
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
                                <Card className="p-4 border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <ListFilter className="w-4 h-4 text-teal-600" />
                                            <h2 className="font-bold text-xl text-slate-800">Projects</h2>
                                        </div>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
                                        {filterTabs.map(tab => {
                                            const isActive = filter === tab.key;
                                            return (
                                                <motion.button
                                                    key={tab.key}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setFilter(tab.key)}
                                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${isActive
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

                                        return (
                                            <motion.div
                                                key={project.id}
                                                variants={listItem} initial="hidden" animate="visible" custom={i}
                                                whileHover={{ scale: 1.01, y: -2 }}
                                                whileTap={{ scale: 0.99 }}
                                                onClick={() => onSelectProject(project)}
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
                                                                    <p className="text-sm text-slate-400 mt-1 leading-relaxed line-clamp-2">{project.brief}</p>
                                                                </div>
                                                                <span
                                                                    className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                                                                    style={{ backgroundColor: color + '12', color }}
                                                                >
                                                                    {isCompleted ? `+${project.xp_earned || project.xp_reward}` : `+${project.xp_reward}`} XP
                                                                </span>
                                                            </div>

                                                            {/* Progress */}
                                                            <div className="flex items-center gap-3 mt-3">
                                                                <div className="flex-1">
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
                                                                <span className="text-sm font-semibold text-slate-500 shrink-0 tabular-nums">
                                                                    {isCompleted ? (
                                                                        <span className="text-emerald-500 flex items-center gap-1">
                                                                            <CheckCircle2 className="w-4 h-4" /> Done
                                                                        </span>
                                                                    ) : (
                                                                        `${project.tasks_completed}/${project.tasks_total}`
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Arrow */}
                                                        <motion.div
                                                            className="shrink-0 self-center text-slate-300"
                                                            whileHover={{ x: 4 }}
                                                        >
                                                            <ChevronRight className="w-5 h-5" />
                                                        </motion.div>
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

                        {/* ══════ RIGHT COLUMN (3 cols) — Profile + Skills ══════ */}
                        <div className="col-span-3 flex flex-col gap-4">

                            {/* Profile Card */}
                            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
                                <Card className="p-5 border-slate-100 text-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => navigate('/profile')}
                                        transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                                        className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3 cursor-pointer overflow-hidden"
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
                                    <h3 className="font-bold text-lg text-slate-800">{user.name || 'Student'}</h3>
                                    <p className="text-sm text-slate-400 mt-0.5">Level {levelInfo.level} • {levelInfo.title}</p>

                                    {/* XP Progress to next level */}
                                    <div className="mt-4 px-2">
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

                                    <div className="grid grid-cols-3 gap-2 mt-4">
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
                                                className="bg-slate-50 rounded-xl py-2.5"
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
            </main>
        </div>
    );
}