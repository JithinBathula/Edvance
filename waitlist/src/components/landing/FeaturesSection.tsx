import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Brain, Terminal, Rocket, Zap, Users, Star } from 'lucide-react';
import { sectionVariants, staggerContainer, staggerItem } from './motionConfig';

export function FeaturesSection() {
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
                whileHover={{ y: -6 }}
                transition={{ duration: 0.24 }}
                className={`group relative overflow-hidden bg-white rounded-2xl border border-gray-100 ${c.border} p-7 hover:shadow-xl hover:shadow-gray-100/80 transition-[transform,box-shadow,border-color,opacity] duration-300 cursor-default transform-gpu [will-change:transform] [backface-visibility:hidden]`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 ${c.bg} rounded-full -translate-y-1/2 translate-x-1/2 opacity-40 group-hover:opacity-75 transition-opacity duration-300`} />
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300 transform-gpu`}>
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
