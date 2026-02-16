import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { StudentClassesPanel } from './student/StudentClassesPanel';
import { StudentSettingsPanel } from './StudentSettings';
import { ProjectList } from './ProjectList';
import { CustomProjectChat } from './CustomProjectChat';
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
    TrendingUp,
    Code2,
    Home,
    Users,
    ArrowLeft,
    BookOpen,
    Settings,
    LogOut,
    Bell,
    Zap,
    ChevronRight,
    Clock,
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
    source_assignment_id?: string | null;
    classroom_name?: string | null;
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
    onProfilePictureUpdate?: (url: string) => void;
    onProfileUpdate?: (data: import('../App').OnboardingData) => void;
    onProjectCreated?: (requirementsData: any) => void;
};

type NavTab = 'Home' | 'Classes' | 'Projects' | 'Settings';

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

export function StudentDashboard({ user, onBack, onSelectProject, onLogout, onProfilePictureUpdate, onProfileUpdate, onProjectCreated }: Props) {
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeNav, setActiveNav] = useState<NavTab>('Home');
    const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed'>('in_progress');
    const [visitedTabs, setVisitedTabs] = useState<Record<'Classes' | 'Projects', boolean>>({ Classes: false, Projects: false });
    const dashboardFetchInFlightRef = useRef(false);
    const dashboardRetryTimersRef = useRef<number[]>([]);
    const isMountedRef = useRef(true);

    const todayTip = TIPS[new Date().getDate() % TIPS.length];
    const [classesKey, setClassesKey] = useState(0);
    const [projectsKey, setProjectsKey] = useState(0);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationsRef = useRef<HTMLDivElement | null>(null);
    const [showCreateProject, setShowCreateProject] = useState(false);

    useEffect(() => {
        if (activeNav === 'Classes') setClassesKey(k => k + 1);
        else if (activeNav === 'Projects') setProjectsKey(k => k + 1);
        if (activeNav === 'Classes' || activeNav === 'Projects') {
            setVisitedTabs(prev => (prev[activeNav] ? prev : { ...prev, [activeNav]: true }));
        }
    }, [activeNav]);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (!notificationsRef.current) return;
            if (!notificationsRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (!data) return;
        const count =
            Math.min(data.in_progress_projects.length, 2) +
            (data.stats.current_streak > 0 ? 1 : 0);
        setUnreadCount(count);
    }, [data?.in_progress_projects.length, data?.stats.current_streak]);

    useEffect(() => {
        if (notificationsOpen && unreadCount > 0) setUnreadCount(0);
    }, [notificationsOpen, unreadCount]);

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
            <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #cffafe, #f0fdfa, #fef3c7)' }}>
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
            <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #cffafe, #f0fdfa, #fef3c7)' }}>
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

    const navItems: { icon: typeof Home; label: NavTab }[] = [
        { icon: Home, label: 'Home' },
        { icon: Users, label: 'Classes' },
        { icon: BookOpen, label: 'Projects' },
    ];

    const filterTabs = [
        { key: 'in_progress' as const, label: 'In Progress', count: in_progress_projects.length },
        { key: 'completed' as const, label: 'Completed', count: completed_projects.length },
        { key: 'all' as const, label: 'All', count: allProjects.length },
    ];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #cffafe, #f0fdfa, #fef3c7)' }}>
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
                                onClick={() => { if (isActive) return; setActiveNav(item.label); }}
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

                <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
                    {[
                        { icon: Settings, label: 'Settings' as const, onClick: () => setActiveNav('Settings') },
                        { icon: LogOut, label: 'Log Out' as const, onClick: onLogout },
                    ].map(item => {
                        const isActive = item.label === 'Settings' && activeNav === 'Settings';
                        return (
                            <motion.button
                                key={item.label}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={item.onClick}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left bg-transparent border-none cursor-pointer ${isActive ? 'bg-teal-500/15 text-teal-300' : 'text-white/35 hover:text-white/60 hover:bg-white/5'}`}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </motion.button>
                        );
                    })}
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
                        {showCreateProject ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setShowCreateProject(false); setActiveNav('Projects'); }}
                                        className="text-slate-400 hover:text-teal-600 transition-colors cursor-pointer bg-transparent border-none p-0"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <h1 className="text-2xl font-bold tracking-tight">
                                        <span className="gradient-text">Create Custom Project</span>
                                    </h1>
                                </div>
                                <p className="text-slate-400 text-sm mt-0.5 ml-7">AI-powered project architect</p>
                            </>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    <span className="text-slate-800">Welcome back, </span>
                                    <span className="gradient-text">{user.name?.split(' ')[0]}!</span>
                                    <span> 👋</span>
                                </h1>
                                <p className="text-slate-400 text-sm mt-0.5">Let's continue your coding journey</p>
                            </>
                        )}
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
                        <div className="relative" ref={notificationsRef}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setNotificationsOpen(prev => !prev)}
                                className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-teal-600 hover:border-teal-200 transition-colors cursor-pointer"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
                                )}
                            </motion.button>

                            <AnimatePresence>
                                {notificationsOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                        transition={{ duration: 0.18 }}
                                        className="absolute right-0 top-12 w-80 rounded-xl border border-slate-200 bg-white shadow-xl z-30 overflow-hidden"
                                    >
                                        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                            <span className="font-semibold text-sm text-slate-800">Notifications</span>
                                            <span className="text-xs text-slate-400">{notifications.length}</span>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {notifications.length > 0 ? notifications.map((n, i) => (
                                                <div key={i} className="px-3 py-2.5 border-b last:border-b-0 border-slate-100 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: n.color }} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-slate-800 leading-snug">{n.title}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                                                            <p className="text-[11px] text-slate-400 mt-1">{n.time}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="px-3 py-6 text-center text-sm text-slate-400">No new notifications</div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base bg-gradient-to-br from-teal-500 to-teal-600 overflow-hidden"
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
                        </div>
                    </div>
                </motion.div>

                {/* ── 2-Column Grid ── */}
                {showCreateProject && onProjectCreated ? (
                    <div className="flex-1 overflow-hidden">
                        <CustomProjectChat
                            user={user}
                            onProjectCreated={onProjectCreated}
                            onBack={() => { setShowCreateProject(false); setActiveNav('Projects'); }}
                            embedded
                        />
                    </div>
                ) : (
                <div className="flex-1 overflow-y-auto scrollbar-thin">

                    {/* Classes — lazy mount on first visit, then keep mounted */}
                    {visitedTabs.Classes && (
                        <div className={activeNav === 'Classes' ? 'px-6 py-5 max-w-7xl mx-auto' : 'hidden'}>
                            <StudentClassesPanel user={user} onSelectProject={onSelectProject} animationKey={classesKey} />
                        </div>
                    )}

                    {/* Projects — lazy mount on first visit, then keep mounted */}
                    {visitedTabs.Projects && (
                        <div className={activeNav === 'Projects' ? 'px-6 py-5 max-w-7xl mx-auto' : 'hidden'}>
                            <ProjectList
                                user={user}
                                onSelectProject={onSelectProject}
                                onCreateNew={() => setShowCreateProject(true)}
                                onBack={() => setActiveNav('Home')}
                                embedded
                                animationKey={projectsKey}
                            />
                        </div>
                    )}

                    {/* Settings */}
                    {activeNav === 'Settings' && (
                        <div className="px-6 py-5 max-w-7xl mx-auto">
                            <StudentSettingsPanel user={user} onLogout={onLogout} onProfilePictureUpdate={onProfilePictureUpdate} onProfileUpdate={onProfileUpdate} />
                        </div>
                    )}

                    {/* Home — conditionally rendered so staggered animations replay */}
                    {activeNav === 'Home' && (
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
                                        onClick={() => setShowCreateProject(true)}
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
                                                                <span
                                                                    className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                                                                    style={{ backgroundColor: color + '12', color }}
                                                                >
                                                                    {isCompleted ? `+${project.xp_earned || project.xp_reward}` : `+${project.xp_reward}`} XP
                                                                </span>
                                                            </div>

                                                            {/* Progress */}
                                                            <div className="mt-3">
                                                                <div className="flex items-center justify-between text-xs mb-1.5">
                                                                    <span className="font-medium text-slate-500">Progress</span>
                                                                    <span className="text-sm font-semibold text-slate-600 shrink-0 tabular-nums">
                                                                        {isCompleted ? `${project.tasks_total}/${project.tasks_total} tasks` : `${project.tasks_completed}/${project.tasks_total} tasks`}
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
                    )}

                </div>
                )}
            </main>
        </div>
    );
}
