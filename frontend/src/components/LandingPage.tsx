import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Rocket, Brain, Users, Zap,
  Terminal, ArrowRight, CheckCircle2,
  Star, Menu, X, BookOpen, Trophy,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from './ui/button';
import { User } from '../App';
import edvanceLogoSrc from '../assets/edvance-logo.svg';

type Props = { user: User | null };

// ─── Edvance Logo Component (inline SVG for navbar/footer) ────────────

function EdvanceLogo({ size = 36 }: { size?: number }) {
  return (
    <img src={edvanceLogoSrc} alt="Edvance" width={size} height={size} className="object-contain" />
  );
}

// ─── Animation variants ───────────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

// ─── Animated Counter ─────────────────────────────────────────────────

function AnimatedCounter({ target, isInView }: { target: number; isInView: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let startTime: number | null = null;
    const duration = 2000;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target]);
  return <>{count}</>;
}

// ─── Floating Code Token ──────────────────────────────────────────────

function FloatingCodeToken({ text, className, delay }: { text: string; className: string; delay: number }) {
  return (
    <motion.div
      animate={{
        y: [0, -28, 6, -20, 0],
        x: [0, 10, -8, 12, 0],
        rotate: [0, 6, -5, 3, 0],
      }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut" }}
      className={`absolute font-mono font-bold select-none pointer-events-none ${className}`}
    >
      {text}
    </motion.div>
  );
}

// ─── Cody the Caterpillar Mascot ──────────────────────────────────────

function CodyMascot({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body segments - caterpillar body curving upward */}
      {/* Tail segment */}
      <circle cx="12" cy="44" r="7" fill="#6DD4A0" />
      <circle cx="12" cy="44" r="7" fill="url(#codyShine)" />
      {/* Segment 2 */}
      <circle cx="22" cy="38" r="8" fill="#5EC492" />
      <circle cx="22" cy="38" r="8" fill="url(#codyShine)" />
      {/* Segment 3 */}
      <circle cx="33" cy="34" r="8.5" fill="#4DB884" />
      <circle cx="33" cy="34" r="8.5" fill="url(#codyShine)" />
      {/* Head - largest segment */}
      <circle cx="45" cy="28" r="11" fill="#3AAC76" />
      <circle cx="45" cy="28" r="11" fill="url(#codyShine)" />
      {/* Cheek blush */}
      <circle cx="38" cy="31" r="2.5" fill="#FF9E9E" opacity="0.4" />
      <circle cx="52" cy="31" r="2.5" fill="#FF9E9E" opacity="0.4" />
      {/* Eyes */}
      <circle cx="41" cy="25" r="3" fill="white" />
      <circle cx="49" cy="25" r="3" fill="white" />
      <circle cx="42" cy="24.5" r="1.8" fill="#1B5E6B" />
      <circle cx="50" cy="24.5" r="1.8" fill="#1B5E6B" />
      {/* Eye shine */}
      <circle cx="42.7" cy="23.8" r="0.7" fill="white" />
      <circle cx="50.7" cy="23.8" r="0.7" fill="white" />
      {/* Happy smile */}
      <path d="M42 30.5 Q45 34 48 30.5" stroke="#1B5E6B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Antennae */}
      <line x1="42" y1="18" x2="38" y2="11" stroke="#3AAC76" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="37.5" cy="10" r="2.5" fill="#F59E0B" />
      <line x1="48" y1="18" x2="52" y2="11" stroke="#3AAC76" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="52.5" cy="10" r="2.5" fill="#F59E0B" />
      {/* Tiny feet */}
      <circle cx="10" cy="51" r="1.5" fill="#3AAC76" />
      <circle cx="14" cy="51" r="1.5" fill="#3AAC76" />
      <circle cx="20" cy="46" r="1.5" fill="#3AAC76" />
      <circle cx="24" cy="46" r="1.5" fill="#3AAC76" />
      <circle cx="31" cy="43" r="1.5" fill="#3AAC76" />
      <circle cx="35" cy="43" r="1.5" fill="#3AAC76" />
      {/* Gradient def */}
      <defs>
        <radialGradient id="codyShine" cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ─── Hero Split Visual (Error → Cody helps) ──────────────────────────

function HeroVisual() {
  return (
    <div className="relative w-full">
      <div className="absolute -inset-6 bg-gradient-to-r from-red-400/10 to-teal-400/15 rounded-3xl blur-3xl" />
      <div className="relative flex flex-col gap-6">
        {/* Error terminal */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative"
        >
          {/* Red glow behind terminal */}
          <div className="absolute -inset-3 bg-red-500/20 rounded-3xl blur-2xl" />
          <div className="absolute -inset-6 bg-red-400/10 rounded-3xl blur-3xl" />
        <div
          className="relative bg-[#0f172a] rounded-2xl shadow-2xl shadow-red-900/20 border border-red-500/20 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-[#1e293b]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="ml-2 text-[10px] text-white/40 font-mono">terminal</span>
          </div>
          <div className="p-4 font-mono text-xs leading-relaxed">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              <span className="text-slate-500">$ python main.py</span>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="mt-2">
              <span className="text-slate-500">File &quot;main.py&quot;, line 12</span>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
              <span className="text-white/60">{'    '}expenses = [250 400 375]</span>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
              <span className="text-white/40">{'                    '}^^^</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.8, duration: 0.4 }}
              className="mt-1"
            >
              <span className="text-red-400 font-bold">SyntaxError:</span>
              <span className="text-red-300"> invalid syntax. Perhaps you forgot a comma?</span>
            </motion.div>
          </div>
        </div>
        </motion.div>

        {/* Cody's help bubble */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 2.4, duration: 0.6, type: 'spring', stiffness: 200, damping: 18 }}
          className="relative bg-white rounded-2xl shadow-xl border border-teal-200/60 p-5 ml-4"
        >
          {/* Speech bubble arrow */}
          <div className="absolute -top-2 left-10 w-4 h-4 bg-white border-l border-t border-teal-200/60 rotate-45" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="shrink-0"
              >
                <CodyMascot size={40} />
              </motion.div>
              <span className="text-lg font-bold text-[#1B5E6B]">Cody</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 font-medium">AI Helper</span>
            </div>

            <div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.8, duration: 0.5 }}
                className="text-sm text-slate-600 leading-relaxed"
              >
                Take a look at <span className="font-semibold text-teal-700">line 12</span> — the error says &quot;invalid syntax.&quot; What do you think is missing between those numbers in the list?
              </motion.p>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ delay: 3.3, duration: 0.4 }}
                className="mt-2.5 bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 italic border border-slate-100"
              >
                Hint: Python lists separate items with a specific character...
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3.8, duration: 0.4 }}
                className="mt-3 flex gap-2"
              >
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium cursor-default shadow-sm">
                  <Zap className="w-3 h-3" />
                  Explain this error
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium cursor-default">
                  Give me a hint
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Caption */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.8 }}
          className="text-center text-base text-slate-600 font-medium mt-2"
        >
          Real-time help, right when you need it.
        </motion.p>
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────

function Navbar({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Projects', href: '#projects' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'For Teachers', href: '#for-teachers' },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-xl bg-white/80 border-b border-gray-200/60 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="w-full px-6 lg:px-10 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <EdvanceLogo size={36} />
          <span className="text-xl font-bold text-[#1B5E6B]">
            edvance
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button
              onClick={() => navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student-dashboard')}
              className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 shadow-md shadow-teal-500/20"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="text-slate-600 hover:text-teal-600"
              >
                Log In
              </Button>
              <Button
                onClick={() => navigate('/signup')}
                className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 shadow-md shadow-teal-500/20"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-slate-600 hover:text-teal-600 transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-6 py-4 space-y-3">
              {navLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium text-slate-600 hover:text-teal-600 py-2"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                {user ? (
                  <Button
                    onClick={() => navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student-dashboard')}
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white"
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => navigate('/login')} className="w-full">Log In</Button>
                    <Button onClick={() => navigate('/signup')} className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white">Get Started</Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────

function HeroSection({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden">
      {/* Full-width gradient background */}
      <motion.div style={{ y: bgY }} className="absolute inset-0">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #cffafe 0%, #f0fdfa 35%, #ffffff 60%, #fef3c7 100%)' }} />
      </motion.div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #0d9488 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Animated gradient orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 -left-40 w-[500px] h-[500px] bg-teal-400/20 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.25, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -bottom-20 -right-40 w-[600px] h-[600px] bg-amber-300/15 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.2, 0.08] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[80px]"
      />

      {/* Floating code tokens — scattered across hero */}
      <FloatingCodeToken text="{ }" className="text-teal-600/25 text-4xl top-[10%] left-[5%]" delay={0} />
      <FloatingCodeToken text="< />" className="text-amber-500/20 text-3xl top-[18%] right-[8%]" delay={1.5} />
      <FloatingCodeToken text="def" className="text-teal-700/20 text-2xl bottom-[32%] left-[3%]" delay={0.8} />
      <FloatingCodeToken text="=>" className="text-teal-500/20 text-3xl bottom-[15%] right-[5%]" delay={2} />
      <FloatingCodeToken text="( )" className="text-amber-500/18 text-2xl top-[52%] left-[10%]" delay={1.2} />
      <FloatingCodeToken text="[ ]" className="text-teal-600/22 text-3xl top-[6%] right-[20%]" delay={0.5} />
      <FloatingCodeToken text="print" className="text-teal-700/15 text-xl bottom-[22%] right-[28%]" delay={1.8} />
      <FloatingCodeToken text="#" className="text-teal-500/20 text-4xl top-[40%] left-[2%]" delay={0.3} />
      <FloatingCodeToken text="if" className="text-amber-600/18 text-2xl top-[70%] left-[8%]" delay={2.5} />
      <FloatingCodeToken text="for" className="text-teal-600/18 text-2xl top-[30%] left-[18%]" delay={1} />
      <FloatingCodeToken text="class" className="text-teal-700/15 text-xl bottom-[10%] left-[15%]" delay={3} />
      <FloatingCodeToken text="import" className="text-amber-500/15 text-lg top-[15%] left-[35%]" delay={0.6} />
      <FloatingCodeToken text="True" className="text-teal-500/18 text-xl bottom-[40%] right-[15%]" delay={1.4} />
      <FloatingCodeToken text="while" className="text-amber-600/15 text-xl top-[65%] right-[20%]" delay={2.2} />
      <FloatingCodeToken text="+" className="text-teal-600/22 text-3xl top-[45%] right-[3%]" delay={0.9} />
      <FloatingCodeToken text="==" className="text-teal-500/18 text-2xl bottom-[5%] right-[40%]" delay={1.7} />
      <FloatingCodeToken text="&&" className="text-amber-500/15 text-2xl top-[5%] left-[48%]" delay={2.8} />
      <FloatingCodeToken text="return" className="text-teal-700/15 text-lg top-[75%] right-[35%]" delay={3.2} />

      {/* Content - centered with max-width */}
      <motion.div style={{ y: textY }} className="relative w-full px-6 lg:px-16 xl:px-24 py-12 pt-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          {/* Left - Text */}
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.div variants={staggerItem}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-700 text-sm font-medium mb-6 border border-teal-500/10">
                <Sparkles className="w-4 h-4" />
                AI-Powered Learning Platform
              </span>
            </motion.div>

            <motion.h1
              variants={staggerItem}
              className="text-[3.375rem] font-bold text-slate-800 leading-[1.08] tracking-tight"
            >
              Coding is hard.<br />
              <span style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                You shouldn&apos;t do it alone.
              </span>
            </motion.h1>

            <motion.p variants={staggerItem} className="mt-8 text-lg sm:text-xl text-slate-500 leading-relaxed max-w-xl">
              Don&apos;t struggle in silence. Edvance gives you an AI partner that helps you debug, plan,
              and learn in real-time. Turn &ldquo;I give up&rdquo; into &ldquo;I did it.&rdquo;
            </motion.p>

            <motion.div variants={staggerItem} className="mt-12 flex flex-wrap gap-4">
              {user ? (
                <Button
                  size="lg"
                  onClick={() => navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student-dashboard')}
                  className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 px-8 h-13 text-base rounded-xl shadow-lg shadow-teal-500/25"
                >
                  Go to Dashboard <ArrowRight className="w-5 h-5" />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={() => navigate('/signup')}
                    className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 px-8 h-13 text-base rounded-xl shadow-lg shadow-teal-500/25"
                  >
                    Start Your First Project <ArrowRight className="w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="gap-2 px-8 h-13 text-base rounded-xl border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600"
                  >
                    Log In
                  </Button>
                </>
              )}
            </motion.div>

            <motion.div variants={staggerItem} className="mt-12 flex items-center gap-8 text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-teal-600" />
                </div>
                AI-Powered
              </span>
              <span className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Rocket className="w-3.5 h-3.5 text-amber-600" />
                </div>
                Real Projects
              </span>
              <span className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center">
                  <Terminal className="w-3.5 h-3.5 text-teal-600" />
                </div>
                Built-in IDE
              </span>
            </motion.div>
          </motion.div>

          {/* Right - Error → Cody helps visual */}
          <div className="hidden lg:block">
            <HeroVisual />
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Features Section ─────────────────────────────────────────────────

function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const features = [
    { icon: Brain, title: 'AI Project Guide', description: 'Get personalized AI guidance that adapts to your skill level. Like having a tutor available 24/7.', color: 'teal' },
    { icon: Terminal, title: 'Real Code Editor', description: 'Write, run, and debug code in a built-in IDE. No setup required — just start coding.', color: 'cyan' },
    { icon: Rocket, title: 'Project-Based Learning', description: 'Learn by building real projects, not toy exercises. Build a portfolio while you learn.', color: 'amber' },
    { icon: Zap, title: 'Instant Feedback', description: 'Submit your code and get AI-powered feedback in seconds. Understand your mistakes and improve.', color: 'orange' },
    { icon: Users, title: 'Classroom Integration', description: 'Teachers can create assignments, manage classrooms, and track student progress in real-time.', color: 'teal' },
    { icon: Star, title: 'XP & Progress', description: 'Earn XP, level up, and track your coding journey with detailed analytics and milestones.', color: 'amber' },
  ];

  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    teal: { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'group-hover:border-teal-200' },
    cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600', border: 'group-hover:border-cyan-200' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'group-hover:border-amber-200' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'group-hover:border-orange-200' },
  };

  return (
    <section id="features" ref={ref} className="py-16 px-6 lg:px-10">
      <div className="w-full">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-10 max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-600 text-xs font-medium mb-4">
            Features
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800">
            Everything You Need to{' '}
            <span style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Master Coding
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            From AI-powered guidance to real-time code execution, Edvance gives you all the tools to become a confident programmer.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-6xl mx-auto"
        >
          {features.map((f, i) => {
            const c = colorMap[f.color];
            return (
              <motion.div
                key={i}
                variants={staggerItem}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className={`group relative overflow-hidden bg-white rounded-2xl border border-gray-100 ${c.border} p-7 hover:shadow-xl hover:shadow-gray-100/80 transition-all duration-300 cursor-default`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 ${c.bg} rounded-full -translate-y-1/2 translate-x-1/2 opacity-40 group-hover:opacity-100 group-hover:w-44 group-hover:h-44 transition-all duration-300`} />
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <f.icon className={`w-6 h-6 ${c.icon}`} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Student Projects Showcase ────────────────────────────────────────

function StudentProjectsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const projects = [
    {
      emoji: '💰',
      title: 'Expense Tracker',
      description: 'Create a menu-driven app to track expenses with categories, totals, and spending analysis.',
      tags: ['Dictionaries', 'Functions', 'File I/O'],
      xp: 110,
      tasks: 11,
      color: '#f59e0b',
      image: '/projects/expense-tracker.png',
    },
    {
      emoji: '📊',
      title: 'Text Similarity Checker',
      description: 'Compare two pieces of text using NLP techniques to determine how similar they are.',
      tags: ['AI/NLP', 'Strings', 'Algorithms'],
      xp: 170,
      tasks: 17,
      color: '#7c3aed',
      image: '/projects/text-similarity.png',
    },
    {
      emoji: '🤖',
      title: 'AI Chatbot',
      description: 'Build a rule-based chatbot that understands patterns and responds intelligently to user queries.',
      tags: ['AI', 'Regex', 'OOP'],
      xp: 200,
      tasks: 20,
      color: '#0891b2',
      image: '/projects/ai-chatbot.png',
    },
        {
      emoji: '🎮',
      title: 'Terminal Hangman',
      description: 'Build a classic word-guessing game where players try to reveal a hidden word one letter at a time.',
      tags: ['Loops', 'Conditionals', 'Lists'],
      xp: 140,
      tasks: 14,
      color: '#0d9488',
      image: '/projects/hangman.png',
    },
    {
      emoji: '🎲',
      title: 'Number Guessing AI',
      description: 'Create a game where the computer uses binary search to guess your number in minimal attempts.',
      tags: ['Algorithms', 'Binary Search', 'Logic'],
      xp: 130,
      tasks: 12,
      color: '#db2777',
      image: '/projects/number-guessing.png',
    },
    {
      emoji: '📈',
      title: 'Stock Price Analyzer',
      description: 'Analyze historical stock data, calculate moving averages, and detect trends using Python.',
      tags: ['Data Analysis', 'Statistics', 'Visualization'],
      xp: 180,
      tasks: 16,
      color: '#059669',
      image: '/projects/stock-analyzer.png',
    },
  ];

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 400;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section id="projects" ref={ref} className="py-16 overflow-hidden" style={{ background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 50%, #fffbeb 100%)' }}>
      <div className="px-6 lg:px-10 mb-10 max-w-6xl mx-auto">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          <div className="flex items-end justify-between">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-medium mb-4">
                <Trophy className="w-3.5 h-3.5" />
                Student Projects
              </span>
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-800">
                Real Projects Built by{' '}
                <span style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Our Students
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-500 max-w-2xl">
                From terminal games to AI-powered apps, see the kind of Python projects you&apos;ll build on Edvance.
              </p>
            </div>
            <div className="hidden sm:flex gap-2">
              <button onClick={() => scroll('left')} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => scroll('right')} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <div ref={scrollRef} className="flex gap-6 px-6 lg:px-10 pb-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-w-6xl mx-auto">
        {projects.map((project, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className="flex-shrink-0 w-[340px] bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group cursor-default"
          >
            {/* Image preview */}
            <div className="h-[200px] bg-slate-100 overflow-hidden">
              <img src={project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>

            {/* Project info */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{project.emoji}</span>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{project.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{project.tasks} tasks</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: project.color + '15', color: project.color }}>
                  +{project.xp} XP
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── How It Works Section ─────────────────────────────────────────────

function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const steps = [
    { number: '01', icon: Sparkles, title: 'Describe Your Project', description: 'Tell our AI what you want to build. It creates a personalized learning plan with milestones tailored to your skill level.', color: 'from-teal-500 to-teal-600' },
    { number: '02', icon: Terminal, title: 'Code with AI Guidance', description: 'Write real code in our built-in editor. Get hints, explanations, and instant feedback as you progress through each task.', color: 'from-cyan-500 to-teal-500' },
    { number: '03', icon: Rocket, title: 'Submit & Level Up', description: 'Submit your completed tasks, earn XP, unlock achievements, and build your portfolio project by project.', color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-16 px-6 lg:px-10" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f0fdfa 50%, #ffffff 100%)' }}>
      <div className="w-full max-w-6xl mx-auto">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-600 text-xs font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800">
            Three Steps to{' '}
            <span style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Start Building
            </span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-[2px]">
            <motion.div
              className="h-full rounded-full origin-left"
              style={{ background: 'linear-gradient(90deg, #0d9488, #14b8a6, #f59e0b)' }}
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 1.5, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </div>

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.3 + i * 0.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              className="text-center relative bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-xl transition-all duration-300"
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                <step.icon className="w-7 h-7 text-white" />
              </div>
              <span className="text-6xl font-black" style={{ background: 'linear-gradient(135deg, #0d9488, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', opacity: 0.2 }}>
                {step.number}
              </span>
              <h3 className="text-xl font-bold text-slate-800 mt-2">{step.title}</h3>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Teachers Section ─────────────────────────────────────────────

function ForTeachersSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const features = [
    'Create and manage virtual classrooms',
    'Assign customized coding projects',
    'Real-time student progress tracking',
    'AI-assisted grading and feedback',
    'Detailed analytics and reports',
  ];

  return (
    <section id="for-teachers" ref={ref} className="py-16 px-6 lg:px-10">
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 text-teal-600 text-sm font-medium mb-6">
              <BookOpen className="w-4 h-4" />
              For Educators
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-800 leading-tight">
              Powerful Tools for{' '}
              <span style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Educators
              </span>
            </h2>
            <p className="mt-4 text-lg text-slate-500 leading-relaxed">
              Create classrooms, assign projects, and track every student's progress in real-time. Focus on teaching while AI handles the heavy lifting.
            </p>
            <ul className="mt-8 space-y-4">
              {features.map((feature, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3 text-slate-600"
                >
                  <div className="w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  </div>
                  <span>{feature}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-r from-teal-100/50 to-cyan-100/50 rounded-3xl blur-3xl" />
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Python Fundamentals</p>
                      <p className="text-xs text-slate-400">28 students enrolled</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-600 text-xs font-semibold">Active</span>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { name: 'Sarah K.', progress: 85, color: '#0d9488' },
                    { name: 'James L.', progress: 72, color: '#f59e0b' },
                    { name: 'Aisha M.', progress: 93, color: '#0d9488' },
                    { name: 'Wei T.', progress: 58, color: '#f97316' },
                  ].map((student, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.6 + i * 0.12 }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-teal-50/50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center text-xs font-bold text-teal-700">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{student.name}</p>
                        <div className="mt-1.5 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: student.color }}
                            initial={{ width: 0 }}
                            animate={isInView ? { width: `${student.progress}%` } : { width: 0 }}
                            transition={{ duration: 1.2, delay: 0.9 + i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">{student.progress}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats Section ────────────────────────────────────────────────────

function StatsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  const stats = [
    { value: 5, suffix: '+', label: 'Python Levels', icon: Rocket },
    { value: 20, suffix: '+', label: 'Real-World Projects', icon: BookOpen },
    { value: 50, suffix: '+', label: 'Coding Concepts', icon: Brain },
    { value: 24, suffix: '/7', label: 'AI Assistance', icon: Zap },
  ];

  return (
    <section ref={ref} className="py-14 px-6 lg:px-10 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #115e59 100%)' }}>
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-teal-400/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-[80px]" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-400/5 rounded-full translate-x-1/3 translate-y-1/3 blur-[80px]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center relative">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ delay: i * 0.12, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
              <stat.icon className="w-6 h-6 text-teal-300" />
            </div>
            <div className="text-4xl md:text-5xl font-black text-white">
              <AnimatedCounter target={stat.value} isInView={isInView} />
              {stat.suffix}
            </div>
            <p className="text-teal-200/60 mt-2 text-sm font-medium">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── CTA Section ──────────────────────────────────────────────────────

function CTASection({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section ref={ref} className="py-16 px-6 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="max-w-5xl mx-auto"
      >
        <div className="relative">
          <div className="absolute -inset-8 bg-gradient-to-r from-teal-100/40 to-amber-100/30 rounded-[2rem] blur-3xl" />
          <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 50%, #fffbeb 100%)' }}>
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #0d9488 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="relative p-10 md:p-14 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 flex items-center justify-center mx-auto mb-8"
              >
                <EdvanceLogo size={72} />
              </motion.div>
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-800">
                Ready to Start Your{' '}
                <span style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Coding Journey
                </span>
                ?
              </h2>
              <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto">
                Start building real Python projects with AI guidance. No setup needed; just jump in and code.
              </p>
              <div className="mt-10">
                {user ? (
                  <Button
                    size="lg"
                    onClick={() => navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student-dashboard')}
                    className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 px-10 h-14 text-lg rounded-xl shadow-lg shadow-teal-500/25"
                  >
                    Go to Dashboard <ArrowRight className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => navigate('/signup')}
                    className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 px-10 h-14 text-lg rounded-xl shadow-lg shadow-teal-500/25"
                  >
                    Get Started for Free <ArrowRight className="w-5 h-5" />
                  </Button>
                )}
              </div>
              {!user && <p className="mt-4 text-sm text-slate-400">No credit card required</p>}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0c4a4e 100%)' }}>
      <div className="w-full px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-7xl mx-auto">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <EdvanceLogo size={36} />
              <span className="text-xl font-bold text-teal-200">
                edvance
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              AI-powered project-based learning platform that helps students master coding through hands-on experience.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Features', href: '#features' },
                { label: 'Student Projects', href: '#projects' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'For Teachers', href: '#for-teachers' },
              ].map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-teal-300 transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Get Started</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Sign Up', href: '/signup' },
                { label: 'Log In', href: '/login' },
              ].map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-teal-300 transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center max-w-7xl mx-auto">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Edvance. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────

export function LandingPage({ user }: Props) {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar user={user} />
      <HeroSection user={user} />
      <FeaturesSection />
      <StudentProjectsSection />
      <HowItWorksSection />
      <ForTeachersSection />
      <StatsSection />
      <CTASection user={user} />
      <Footer />
    </div>
  );
}
