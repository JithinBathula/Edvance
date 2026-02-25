import { useState } from 'react';
import { Navbar } from './components/landing/Navbar';
import { HeroSection } from './components/landing/HeroSection';
import { FeaturesSection } from './components/landing/FeaturesSection';
import { StudentProjectsSection } from './components/landing/StudentProjectsSection';
import { HowItWorksSection } from './components/landing/HowItWorksSection';
import { ForTeachersSection } from './components/landing/ForTeachersSection';
import { StatsSection } from './components/landing/StatsSection';
import { CTASection } from './components/landing/CTASection';
import { Footer } from './components/landing/Footer';
import { WaitlistModal } from './components/WaitlistModal';

export default function App() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const openWaitlist = () => setWaitlistOpen(true);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar onJoinWaitlist={openWaitlist} />
      <HeroSection onJoinWaitlist={openWaitlist} />
      <FeaturesSection />
      <StudentProjectsSection />
      <HowItWorksSection />
      <ForTeachersSection />
      <StatsSection />
      <CTASection onJoinWaitlist={openWaitlist} />
      <Footer />
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  );
}
