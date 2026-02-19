import type { User } from '../App';
import { Navbar } from './landing/Navbar';
import { HeroSection } from './landing/HeroSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { StudentProjectsSection } from './landing/StudentProjectsSection';
import { HowItWorksSection } from './landing/HowItWorksSection';
import { ForTeachersSection } from './landing/ForTeachersSection';
import { StatsSection } from './landing/StatsSection';
import { CTASection } from './landing/CTASection';
import { Footer } from './landing/Footer';

type Props = { user: User | null };

export function LandingPage({ user }: Props) {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar user={user} />
      <HeroSection user={user} />
      <FeaturesSection />
      <StudentProjectsSection />
      <HowItWorksSection />
      <ForTeachersSection />
      <StatsSection />
      <CTASection user={user} />
      <Footer />
    </div>
  );
}
