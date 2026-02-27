import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Rocket, BookOpen, Brain, Zap } from 'lucide-react';
import { LANDING_EASE } from './motionConfig';

function AnimatedCounter({ target, isInView }: { target: number; isInView: boolean }) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!isInView || doneRef.current) return;
    let startTime: number | null = null;
    let rafId: number;
    const duration = 2000;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        doneRef.current = true;
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, target]);

  return <>{count}</>;
}

export function StatsSection() {
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
      <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full -translate-x-1/2 -translate-y-1/2" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.1) 0%, rgba(45,212,191,0) 70%)' }} />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full translate-x-1/3 translate-y-1/3" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.05) 0%, rgba(251,191,36,0) 70%)' }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="max-w-6xl mx-auto grid grid-cols-4 gap-10 text-center relative">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ delay: i * 0.12, duration: 0.6, ease: LANDING_EASE }}
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
