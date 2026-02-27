import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { LANDING_EASE, sectionVariants } from './motionConfig';

export function StudentProjectsSection() {
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
      image: '/projects/expense-tracker.jpg',
    },
    {
      emoji: '📊',
      title: 'Text Similarity Checker',
      description: 'Compare two pieces of text using NLP techniques to determine how similar they are.',
      tags: ['AI/NLP', 'Strings', 'Algorithms'],
      xp: 170,
      tasks: 17,
      color: '#7c3aed',
      image: '/projects/text-similarity.jpg',
    },
    {
      emoji: '🤖',
      title: 'AI Chatbot',
      description: 'Build a rule-based chatbot that understands patterns and responds intelligently to user queries.',
      tags: ['AI', 'Regex', 'OOP'],
      xp: 200,
      tasks: 20,
      color: '#0891b2',
      image: '/projects/ai-chatbot.jpg',
    },
    {
      emoji: '🎮',
      title: 'Terminal Hangman',
      description: 'Build a classic word-guessing game where players try to reveal a hidden word one letter at a time.',
      tags: ['Loops', 'Conditionals', 'Lists'],
      xp: 140,
      tasks: 14,
      color: '#0d9488',
      image: '/projects/hangman.jpg',
    },
    {
      emoji: '🎲',
      title: 'Number Guessing AI',
      description: 'Create a game where the computer uses binary search to guess your number in minimal attempts.',
      tags: ['Algorithms', 'Binary Search', 'Logic'],
      xp: 130,
      tasks: 12,
      color: '#db2777',
      image: '/projects/number-guessing.jpg',
    },
    {
      emoji: '📈',
      title: 'Stock Price Analyzer',
      description: 'Analyze historical stock data, calculate moving averages, and detect trends using Python.',
      tags: ['Data Analysis', 'Statistics', 'Visualization'],
      xp: 180,
      tasks: 16,
      color: '#059669',
      image: '/projects/stock-analyzer.jpg',
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
        <motion.div variants={sectionVariants} initial="hidden" animate={isInView ? 'visible' : 'hidden'}>
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
            initial={{ opacity: 0, y: 32 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.08, duration: 0.55, ease: LANDING_EASE }}
            whileHover={{ y: -6 }}
            className="flex-shrink-0 w-[340px] bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-[transform,box-shadow,opacity] duration-300 group cursor-default transform-gpu [backface-visibility:hidden] hover:[will-change:transform]"
          >
            <div className="h-[200px] bg-slate-100 overflow-hidden">
              <img
                src={project.image}
                alt={project.title}
                width={680}
                height={400}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 transform-gpu"
              />
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{project.emoji}</span>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{project.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{project.tasks} tasks</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: `${project.color}15`, color: project.color }}>
                  +{project.xp} XP
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
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
