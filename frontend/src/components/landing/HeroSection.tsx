import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Sparkles, Rocket, Zap, Terminal, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import type { HeroSectionProps } from './types';
import { LANDING_EASE, staggerContainer, staggerItem } from './motionConfig';

function FloatingCodeToken({ text, className, delay, reducedMotion }: { text: string; className: string; delay: number; reducedMotion: boolean }) {
  return (
    <motion.div
      animate={
        reducedMotion
          ? undefined
          : {
              y: [0, -18, 4, -12, 0],
              x: [0, 6, -5, 7, 0],
              rotate: [0, 4, -3, 2, 0],
            }
      }
      transition={reducedMotion ? undefined : { duration: 6 + delay, repeat: Infinity, ease: 'easeInOut' }}
      className={`absolute font-mono font-bold select-none pointer-events-none transform-gpu ${className}`}
    >
      {text}
    </motion.div>
  );
}

function CodyMascot({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="44" r="7" fill="#6DD4A0" />
      <circle cx="12" cy="44" r="7" fill="url(#codyShine)" />
      <circle cx="22" cy="38" r="8" fill="#5EC492" />
      <circle cx="22" cy="38" r="8" fill="url(#codyShine)" />
      <circle cx="33" cy="34" r="8.5" fill="#4DB884" />
      <circle cx="33" cy="34" r="8.5" fill="url(#codyShine)" />
      <circle cx="45" cy="28" r="11" fill="#3AAC76" />
      <circle cx="45" cy="28" r="11" fill="url(#codyShine)" />
      <circle cx="38" cy="31" r="2.5" fill="#FF9E9E" opacity="0.4" />
      <circle cx="52" cy="31" r="2.5" fill="#FF9E9E" opacity="0.4" />
      <circle cx="41" cy="25" r="3" fill="white" />
      <circle cx="49" cy="25" r="3" fill="white" />
      <circle cx="42" cy="24.5" r="1.8" fill="#1B5E6B" />
      <circle cx="50" cy="24.5" r="1.8" fill="#1B5E6B" />
      <circle cx="42.7" cy="23.8" r="0.7" fill="white" />
      <circle cx="50.7" cy="23.8" r="0.7" fill="white" />
      <path d="M42 30.5 Q45 34 48 30.5" stroke="#1B5E6B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="42" y1="18" x2="38" y2="11" stroke="#3AAC76" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="37.5" cy="10" r="2.5" fill="#F59E0B" />
      <line x1="48" y1="18" x2="52" y2="11" stroke="#3AAC76" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="52.5" cy="10" r="2.5" fill="#F59E0B" />
      <circle cx="10" cy="51" r="1.5" fill="#3AAC76" />
      <circle cx="14" cy="51" r="1.5" fill="#3AAC76" />
      <circle cx="20" cy="46" r="1.5" fill="#3AAC76" />
      <circle cx="24" cy="46" r="1.5" fill="#3AAC76" />
      <circle cx="31" cy="43" r="1.5" fill="#3AAC76" />
      <circle cx="35" cy="43" r="1.5" fill="#3AAC76" />
      <defs>
        <radialGradient id="codyShine" cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function HeroVisual() {
  return (
    <div className="relative w-full">
      <div className="absolute -inset-6 bg-gradient-to-r from-red-400/10 to-teal-400/15 rounded-3xl blur-3xl" />
      <div className="relative flex flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: LANDING_EASE }}
          className="relative"
        >
          <div className="absolute -inset-3 bg-red-500/15 rounded-3xl blur-xl" />
          <div className="absolute -inset-6 bg-red-400/10 rounded-3xl blur-2xl" />
          <div className="relative bg-[#0f172a] rounded-2xl shadow-2xl shadow-red-900/20 border border-red-500/20 overflow-hidden">
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
                initial={{ opacity: 0, scale: 0.97 }}
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

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 2.4, duration: 0.6, type: 'spring', stiffness: 200, damping: 18 }}
          className="relative bg-white rounded-2xl shadow-xl border border-teal-200/60 p-5 ml-4"
        >
          <div className="absolute -top-2 left-10 w-4 h-4 bg-white border-l border-t border-teal-200/60 rotate-45" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="shrink-0">
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
                Take a look at <span className="font-semibold text-teal-700">line 12</span> - the error says &quot;invalid syntax.&quot; What do you think is missing between those numbers in the list?
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

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.8 }} className="text-center text-base text-slate-600 font-medium mt-2">
          Real-time help, right when you need it.
        </motion.p>
      </div>
    </div>
  );
}

export function HeroSection({ user }: HeroSectionProps) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 90]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 45]);

  const floatingTokens = [
    { text: '{ }', className: 'hidden lg:block text-teal-600/25 text-4xl top-[10%] left-[5%]', delay: 0 },
    { text: '< />', className: 'hidden md:block text-amber-500/20 text-3xl top-[18%] right-[8%]', delay: 1.5 },
    { text: 'def', className: 'hidden lg:block text-teal-700/20 text-2xl bottom-[32%] left-[3%]', delay: 0.8 },
    { text: '=>', className: 'hidden lg:block text-teal-500/20 text-3xl bottom-[15%] right-[5%]', delay: 2 },
    { text: '( )', className: 'hidden xl:block text-amber-500/18 text-2xl top-[52%] left-[10%]', delay: 1.2 },
    { text: '[ ]', className: 'hidden md:block text-teal-600/22 text-3xl top-[6%] right-[20%]', delay: 0.5 },
    { text: 'print', className: 'hidden xl:block text-teal-700/15 text-xl bottom-[22%] right-[28%]', delay: 1.8 },
    { text: '#', className: 'hidden lg:block text-teal-500/20 text-4xl top-[40%] left-[2%]', delay: 0.3 },
    { text: 'if', className: 'hidden md:block text-amber-600/18 text-2xl top-[70%] left-[8%]', delay: 2.5 },
    { text: 'return', className: 'hidden xl:block text-teal-700/15 text-lg top-[75%] right-[35%]', delay: 3.2 },
  ];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 transform-gpu">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #cffafe 0%, #f0fdfa 35%, #ffffff 60%, #fef3c7 100%)' }} />
      </motion.div>

      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #0d9488 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <motion.div
        animate={prefersReducedMotion ? undefined : { y: [0, -14, 0], opacity: [0.18, 0.25, 0.18] }}
        transition={prefersReducedMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-0 -left-40 w-[460px] h-[460px] bg-teal-400/16 rounded-full blur-[72px]"
      />
      <motion.div
        animate={prefersReducedMotion ? undefined : { y: [0, 12, 0], opacity: [0.12, 0.2, 0.12] }}
        transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute -bottom-20 -right-40 w-[520px] h-[520px] bg-amber-300/12 rounded-full blur-[72px]"
      />
      <motion.div
        animate={prefersReducedMotion ? undefined : { y: [0, -10, 0], opacity: [0.1, 0.16, 0.1] }}
        transition={prefersReducedMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute top-1/3 right-1/4 w-[360px] h-[360px] bg-teal-500/8 rounded-full blur-[56px]"
      />

      {!prefersReducedMotion &&
        floatingTokens.map((token) => (
          <FloatingCodeToken key={`${token.text}-${token.className}`} text={token.text} className={token.className} delay={token.delay} reducedMotion={false} />
        ))}

      <motion.div style={{ y: textY }} className="relative w-full px-6 lg:px-16 xl:px-24 py-12 pt-24 transform-gpu">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.div variants={staggerItem}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-700 text-sm font-medium mb-6 border border-teal-500/10">
                <Sparkles className="w-4 h-4" />
                AI-Powered Learning Platform
              </span>
            </motion.div>

            <motion.h1 variants={staggerItem} className="text-[3.375rem] font-bold text-slate-800 leading-[1.08] tracking-tight">
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

          <div className="hidden lg:block">
            <HeroVisual />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
