import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { BookOpen, CheckCircle2, Users } from 'lucide-react';
import { LANDING_EASE } from './motionConfig';

export function ForTeachersSection() {
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
    <section id="for-teachers" ref={ref} className="py-16 px-6 lg:px-10" style={{ background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 50%, #ffffff 100%)' }}>
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: LANDING_EASE }}
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
              Create classrooms, assign projects, and track every student&apos;s progress in real-time. Focus on teaching while AI handles the heavy lifting.
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
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: LANDING_EASE }}
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-teal-200/30 to-amber-100/30 rounded-3xl blur-2xl" />
              <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-teal-50/80 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Python Fundamentals</p>
                      <p className="text-[11px] text-slate-400">28 students enrolled</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 text-[11px] font-semibold">Active</span>
                </div>

                <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
                  {[
                    { label: 'Avg Progress', value: '77%', color: 'text-teal-600' },
                    { label: 'Completed', value: '12/28', color: 'text-amber-600' },
                    { label: 'This Week', value: '+8%', color: 'text-teal-600' },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={isInView ? { opacity: 1 } : {}}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="bg-white px-4 py-3 text-center"
                    >
                      <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="p-4 space-y-2">
                  {[
                    { name: 'Sarah K.', progress: 85, color: '#0d9488', status: 'On Track' },
                    { name: 'James L.', progress: 72, color: '#f59e0b', status: 'In Progress' },
                    { name: 'Aisha M.', progress: 93, color: '#0d9488', status: 'Ahead' },
                    { name: 'Wei T.', progress: 58, color: '#f97316', status: 'Needs Help' },
                  ].map((student, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.6 + i * 0.1 }}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center text-[11px] font-bold text-teal-700">
                        {student.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-slate-700">{student.name}</p>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${student.color}15`, color: student.color }}>
                            {student.status}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: student.color }}
                            initial={{ width: 0 }}
                            animate={isInView ? { width: `${student.progress}%` } : { width: 0 }}
                            transition={{ duration: 1.2, delay: 0.8 + i * 0.12, ease: LANDING_EASE }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-400 tabular-nums w-8 text-right">{student.progress}%</span>
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
