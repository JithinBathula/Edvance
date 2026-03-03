import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import edvanceLogoSrc from '../../assets/edvance-logo.svg';
import { LANDING_EASE } from './motionConfig';

function EdvanceLogo({ size = 72 }: { size?: number }) {
  return <img src={edvanceLogoSrc} alt="Edvance" width={size} height={size} className="object-contain" />;
}

export function CTASection({ onJoinWaitlist }: { onJoinWaitlist: () => void }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section ref={ref} className="py-16 px-6 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.8, ease: LANDING_EASE }}
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
                Be the first to experience AI-powered project-based learning. Join the waitlist and we'll notify you when we launch.
              </p>
              <div className="mt-10">
                <Button
                  size="lg"
                  onClick={onJoinWaitlist}
                  className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 px-10 h-14 text-lg rounded-xl shadow-lg shadow-teal-500/25"
                >
                  Join the Waitlist <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
              <p className="mt-4 text-sm text-slate-400">Be the first to know when we launch</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
