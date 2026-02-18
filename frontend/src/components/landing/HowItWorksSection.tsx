import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Terminal, Rocket, ChevronDown } from 'lucide-react';
import { LANDING_EASE, sectionVariants } from './motionConfig';

export function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: '01',
      icon: Sparkles,
      title: 'Describe Your Project',
      description: 'Chat with our requirements agent to define what you want to build — your goals, skill level, and preferences.',
      color: 'from-teal-500 to-teal-600',
      accent: '#0d9488',
      media: '/steps/step-01.gif',
      durationMs: 14900,
    },
    {
      number: '02',
      icon: Brain,
      title: 'Let AI Create Your Project',
      description: 'Our AI generates a personalized project plan with milestones, tasks, and a structured learning path just for you.',
      color: 'from-violet-500 to-purple-600',
      accent: '#8b5cf6',
      media: '/steps/step-02.gif',
      durationMs: 11200,
    },
    {
      number: '03',
      icon: Terminal,
      title: 'Code with AI Guidance',
      description: 'Write real code in our built-in editor. Get hints, explanations, and instant feedback as you progress through each task.',
      color: 'from-cyan-500 to-teal-500',
      accent: '#06b6d4',
      media: '/steps/step-03.gif',
      durationMs: 11700,
    },
    {
      number: '04',
      icon: Rocket,
      title: 'Submit & Level Up',
      description: 'Submit your completed tasks, earn XP, unlock achievements, and build your portfolio project by project.',
      color: 'from-amber-500 to-orange-500',
      accent: '#f59e0b',
      media: '/steps/step-04.gif',
      durationMs: 8800,
    },
  ];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, steps[activeStep].durationMs);
    return () => window.clearTimeout(timeout);
  }, [activeStep]);

  return (
    <section id="how-it-works" ref={ref} className="py-16 px-6 lg:px-10" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f0fdfa 50%, #ffffff 100%)' }}>
      <div className="w-full max-w-6xl mx-auto">
        <motion.div variants={sectionVariants} initial="hidden" animate={isInView ? 'visible' : 'hidden'} className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-600 text-xs font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800">
            Four Steps to{' '}
            <span style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Start Building
            </span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6, ease: LANDING_EASE }}
          className="grid grid-cols-1 md:grid-cols-[0.85fr_1.65fr] gap-8 md:gap-10 items-center"
        >
          <div className="flex flex-col">
            {steps.map((step, i) => {
              const isActive = i === activeStep;
              const isPast = i < activeStep;
              return (
                <div key={i}>
                  <motion.button
                    onClick={() => setActiveStep(i)}
                    className={`relative w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-left transition-[background-color,border-color,box-shadow,transform] duration-300 cursor-pointer ${
                      isActive ? 'bg-white shadow-lg ring-1 ring-teal-200' : 'bg-white/40 hover:bg-white/70'
                    }`}
                    animate={isActive ? { scale: 1 } : { scale: 0.97 }}
                    whileHover={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                        isActive ? `bg-gradient-to-br ${step.color} shadow-md` : isPast ? 'bg-teal-50' : 'bg-gray-100'
                      }`}
                    >
                      <step.icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : isPast ? 'text-teal-400' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-bold transition-colors duration-300 ${isActive ? 'text-teal-600' : 'text-gray-400'}`}>
                        STEP {step.number}
                      </span>
                      <h3 className={`text-[15px] font-semibold mt-0.5 transition-colors duration-300 ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step.title}
                      </h3>
                      <AnimatePresence mode="wait">
                        {isActive && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="text-sm text-slate-500 mt-1 leading-relaxed"
                          >
                            {step.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>

                  {i < steps.length - 1 && (
                    <div className="flex flex-col items-center py-0.5">
                      <div className={`w-[2px] h-4 transition-colors duration-300 ${isPast ? 'bg-teal-300' : 'bg-gray-200'}`} style={isPast ? undefined : { backgroundImage: 'repeating-linear-gradient(to bottom, #e5e7eb 0px, #e5e7eb 4px, transparent 4px, transparent 8px)' }} />
                      <ChevronDown className={`w-4 h-4 -mt-0.5 transition-colors duration-300 ${isPast ? 'text-teal-400' : 'text-gray-300'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-gray-200 shadow-sm aspect-video">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeStep}
                src={steps[activeStep].media}
                alt={steps[activeStep].title}
                width={1280}
                height={960}
                className="absolute inset-0 w-full h-full object-contain"
                initial={{ opacity: 0.05 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.05 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
            </AnimatePresence>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`rounded-full transition-[width,background-color,opacity] duration-300 ${
                    i === activeStep ? 'w-6 h-2 bg-teal-500' : 'w-2 h-2 bg-white/70 hover:bg-white'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
