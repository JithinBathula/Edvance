import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import edvanceLogoSrc from '../../assets/edvance-logo.svg';
import { LANDING_EASE } from './motionConfig';

function EdvanceLogo({ size = 36 }: { size?: number }) {
  return <img src={edvanceLogoSrc} alt="Edvance" width={size} height={size} className="object-contain" />;
}

export function Navbar({ onJoinWaitlist }: { onJoinWaitlist: () => void }) {
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
      transition={{ duration: 0.6, ease: LANDING_EASE }}
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? 'backdrop-blur-xl bg-white/80 border-b border-gray-200/60 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="w-full px-6 lg:px-10 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <EdvanceLogo size={36} />
          <span className="text-xl font-bold text-[#1B5E6B]">edvance</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
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
          <Button
            onClick={onJoinWaitlist}
            className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white gap-2 shadow-md shadow-teal-500/20"
          >
            Join the Waitlist <ArrowRight className="w-4 h-4" />
          </Button>
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
              {navLinks.map((link) => (
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
                <Button
                  onClick={() => { onJoinWaitlist(); setMobileOpen(false); }}
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white"
                >
                  Join the Waitlist
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
