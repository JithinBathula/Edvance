import { ReactNode, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../App';
import { BACKEND_URL } from '../../utils/constants';
import edvanceLogoSrc from '../../assets/edvance-logo.svg';
import {
    Home,
    Users,
    Swords,
    Settings,
    LogOut,
    Flame,
    Zap,
    Bell,
    ArrowLeft,
} from 'lucide-react';

type NavTab = 'Home' | 'Classes' | 'Community' | 'Settings';

interface StudentLayoutProps {
    children: ReactNode;
    user: User;
    onLogout: () => void;
}

type LightStats = {
    current_streak: number;
    total_xp: number;
    in_progress_projects: { title: string; progress: number; created_at: string }[];
};

const navItems: { icon: typeof Home; label: NavTab }[] = [
    { icon: Home, label: 'Home' },
    { icon: Users, label: 'Classes' },
    { icon: Swords, label: 'Community' },
];

export function StudentLayout({ children, user, onLogout }: StudentLayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();

    /* ── Derive active tab from current route ── */
    const activeTab: NavTab | null = (() => {
        const p = location.pathname;
        if (p === '/student-dashboard') return 'Home';
        if (p === '/student/classes') return 'Classes';
        if (p === '/student/community') return 'Community';
        if (p === '/student/settings') return 'Settings';
        return null;
    })();

    /* ── Lightweight stats for header badges + notifications ── */
    const [stats, setStats] = useState<LightStats | null>(null);
    const fetchInFlightRef = useRef(false);

    useEffect(() => {
        if (fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        (async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/dashboard/${user.id}`, { credentials: 'include' });
                const json = await res.json();
                if (json.success) {
                    setStats({
                        current_streak: json.stats.current_streak,
                        total_xp: json.stats.total_xp,
                        in_progress_projects: json.in_progress_projects?.slice(0, 2).map((p: any) => ({
                            title: p.title,
                            progress: p.progress,
                            created_at: p.created_at,
                        })) ?? [],
                    });
                }
            } catch { /* header badges are optional */ }
            fetchInFlightRef.current = false;
        })();
    }, [user.id]);

    /* ── Notifications ── */
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationsRef = useRef<HTMLDivElement | null>(null);

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
        if (!stats) return;
        const count = Math.min(stats.in_progress_projects.length, 2) + (stats.current_streak > 0 ? 1 : 0);
        setUnreadCount(count);
    }, [stats]);

    useEffect(() => {
        if (notificationsOpen && unreadCount > 0) setUnreadCount(0);
    }, [notificationsOpen, unreadCount]);

    const timeAgo = (dateString: string) => {
        const diff = Date.now() - new Date(dateString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    const notifications = stats ? [
        ...stats.in_progress_projects.map(p => ({
            title: p.title,
            message: p.progress > 0 ? `Continue where you left off — ${p.progress}% done` : 'You have a new project to start!',
            time: timeAgo(p.created_at),
            color: '#0d9488',
        })),
        ...(stats.current_streak > 0 ? [{
            title: `${stats.current_streak}-day streak!`,
            message: "You're on fire — keep it going!",
            time: 'Today',
            color: '#f59e0b',
        }] : []),
    ] : [];

    /* ── Sidebar nav click handler ── */
    const navRoutes: Record<NavTab, string> = {
        Home: '/student-dashboard',
        Classes: '/student/classes',
        Community: '/student/community',
        Settings: '/student/settings',
    };

    const handleNavClick = (tab: NavTab) => {
        navigate(navRoutes[tab]);
    };

    const handleSettingsClick = () => {
        navigate('/student/settings');
    };

    /* ── Header: detect special pages ── */
    const isCustomProject = location.pathname === '/custom-project';
    const isSettings = location.pathname === '/student/settings';
    const isProjectPlanning = location.pathname === '/project-planning';

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
            <nav
                className="w-52 shrink-0 flex flex-col px-3 py-5 rounded-r-2xl bg-gradient-to-b from-teal-900/95 to-teal-950/95"
            >
                <div className="flex items-center gap-2 px-3 mb-7">
                    <img src={edvanceLogoSrc} alt="Edvance" width={32} height={32} className="object-contain" />
                    <div>
                        <div className="text-white font-bold text-sm leading-tight">edvance</div>
                        <div className="text-teal-400/70 text-xs">Learning Platform</div>
                    </div>
                </div>

                <div className="flex flex-col gap-0.5">
                    {navItems.map((item, i) => {
                        const isActive = activeTab === item.label;
                        return (
                            <motion.button
                                key={item.label}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleNavClick(item.label)}
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
                        { icon: Settings, label: 'Settings' as const, onClick: handleSettingsClick },
                        { icon: LogOut, label: 'Log Out' as const, onClick: onLogout },
                    ].map(item => {
                        const isActive = item.label === 'Settings' && activeTab === 'Settings';
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
            </nav>

            {/* ═══════════ MAIN CONTENT ═══════════ */}
            <main className="flex-1 bg-transparent rounded-2xl m-2.5 ml-0 overflow-hidden flex flex-col">

                {/* ── Header Bar ── */}
                <div
                    className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0"
                >
                    <div>
                        {isCustomProject ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => navigate('/student-dashboard')}
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
                        ) : isProjectPlanning ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => navigate('/custom-project')}
                                        className="text-slate-400 hover:text-teal-600 transition-colors cursor-pointer bg-transparent border-none p-0"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <h1 className="text-2xl font-bold tracking-tight">
                                        <span className="gradient-text">Project Outline</span>
                                    </h1>
                                </div>
                                <p className="text-slate-400 text-sm mt-0.5 ml-7">Review your learning milestones</p>
                            </>
                        ) : isSettings ? (
                            <>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    <span className="gradient-text">Settings</span>
                                </h1>
                                <p className="text-slate-400 text-sm mt-0.5">Manage your account and preferences</p>
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
                                {stats?.current_streak ?? 0} day streak
                            </div>
                            <div className="flex items-center gap-1.5 bg-teal-50 text-teal-600 px-3 py-1.5 rounded-lg font-semibold">
                                <Zap className="w-4 h-4" />
                                {stats?.total_xp ?? 0} XP
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
                </div>

                {/* ── Content (children) ── */}
                {children}
            </main>
        </div>
    );
}
