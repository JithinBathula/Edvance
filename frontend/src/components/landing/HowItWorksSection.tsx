import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Sparkles, Terminal, Rocket } from 'lucide-react';
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
      description: 'Tell our AI what you want to build. It creates a personalized learning plan with milestones tailored to your skill level.',
      color: 'from-teal-500 to-teal-600',
      accent: '#0d9488',
      media: '/projects/expense-tracker.jpg',
    },
    {
      number: '02',
      icon: Terminal,
      title: 'Code with AI Guidance',
      description: 'Write real code in our built-in editor. Get hints, explanations, and instant feedback as you progress through each task.',
      color: 'from-cyan-500 to-teal-500',
      accent: '#06b6d4',
      media: '/projects/ai-chatbot.jpg',
    },
    {
      number: '03',
      icon: Rocket,
      title: 'Submit & Level Up',
      description: 'Submit your completed tasks, earn XP, unlock achievements, and build your portfolio project by project.',
      color: 'from-amber-500 to-orange-500',
      accent: '#f59e0b',
      media: '/projects/stock-analyzer.jpg',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <section id="how-it-works" ref={ref} className="py-16 px-6 lg:px-10" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f0fdfa 50%, #ffffff 100%)' }}>
      <div className="w-full max-w-6xl mx-auto">
        <motion.div variants={sectionVariants} initial="hidden" animate={isInView ? 'visible' : 'hidden'} className="text-center mb-16">
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

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6, ease: LANDING_EASE }}
          className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8 md:gap-12 items-center"
        >
          <div className="relative flex flex-col gap-0">
            <div className="absolute left-[22px] top-[44px] bottom-[44px] w-[2px] hidden md:block">
              <div className="h-full w-full rounded-full bg-gray-200" />
              <motion.div
                className="absolute top-0 left-0 w-full rounded-full"
                style={{ background: 'linear-gradient(180deg, #0d9488, #14b8a6, #f59e0b)' }}
                animate={{ height: `${(activeStep / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 0.45, ease: LANDING_EASE }}
              />
            </div>

            {steps.map((step, i) => {
              const isActive = i === activeStep;
              return (
                <motion.button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`relative flex items-start gap-4 p-5 rounded-xl text-left transition-[background-color,border-color,box-shadow,transform] duration-300 cursor-pointer ${
                    isActive ? 'bg-white shadow-lg border border-teal-100' : 'bg-transparent border border-transparent hover:bg-white/60'
                  }`}
                  whileHover={{ x: isActive ? 0 : 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                        isActive ? `bg-gradient-to-br ${step.color} shadow-md` : 'bg-gray-100'
                      }`}
                    >
                      <step.icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <span
                      className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors duration-300 ${
                        isActive ? 'bg-white border-2 text-slate-700 shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-400'
                      }`}
                      style={isActive ? { borderColor: step.accent } : {}}
                    >
                      {step.number}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-semibold transition-colors duration-300 ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step.title}
                    </h3>
                    <AnimatePresence mode="wait">
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.25 }}
                          className="text-sm text-slate-500 mt-1.5 leading-relaxed"
                        >
                          {step.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-slate-50 border border-gray-200 shadow-sm aspect-[4/3]">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeStep}
                src={steps[activeStep].media}
                alt={steps[activeStep].title}
                width={1280}
                height={960}
                className="absolute inset-0 w-full h-full object-cover"
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
