import edvanceLogoSrc from '../../assets/edvance-logo.svg';

function EdvanceLogo({ size = 36 }: { size?: number }) {
  return <img src={edvanceLogoSrc} alt="Edvance" width={size} height={size} className="object-contain" />;
}

export function Footer() {
  return (
    <footer style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0c4a4e 100%)' }}>
      <div className="w-full px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-7xl mx-auto">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <EdvanceLogo size={36} />
              <span className="text-xl font-bold text-teal-200">edvance</span>
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
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-teal-300 transition-colors">
                    {link.label}
                  </a>
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
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-slate-400 hover:text-teal-300 transition-colors">
                    {link.label}
                  </a>
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
