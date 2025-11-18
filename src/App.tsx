import { useState, useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { LoginScreen } from "./components/LoginScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { LandingPage } from "./components/LandingPage";
import { CoursePage } from "./components/CoursePage";
import { CustomProjectChat } from "./components/CustomProjectChat";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { ProfilePage } from "./components/ProfilePage";

export type OnboardingData = {
  pythonExperience: string;
  experienceLevel: string;
  goal: string;
  theme: string;
};

export type User = {
  name: string;
  onboarding: OnboardingData | null;
  createdAt: string;
  xp: number;
  completedProjects: string[];
  projects?: string[];
};

export type Screen =
  | "login"
  | "onboarding"
  | "landing"
  | "course"
  | "customProjectChat"
  | "projectWorkspace"
  | "profile";

export default function App() {
  const [currentScreen, setCurrentScreen] =
    useState<Screen>("login");
  const [user, setUser] = useState<User | null>(null);
  const [currentProject, setCurrentProject] =
    useState<any>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
    if (userData.onboarding) {
      setCurrentScreen("landing");
    } else {
      setCurrentScreen("onboarding");
    }
  };

  const handleOnboardingComplete = (
    onboardingData: OnboardingData,
  ) => {
    if (user) {
      setUser({ ...user, onboarding: onboardingData });
    }
    setCurrentScreen("landing");
  };

  const handleStartCourse = () => {
    setCurrentScreen("course");
  };

  const handleStartCustomProject = () => {
    setCurrentScreen("customProjectChat");
  };

  const handleProjectCreated = (data: any) => {
    console.log("📦 Data received from Chat:", data);

    // For planning stage ppl, if tasks exist, open workspace directly
    if (data.tasks && Array.isArray(data.tasks)) {
      setCurrentProject(data);
      setCurrentScreen("projectWorkspace");
    } else {
      // Current state (Requirements gathered only).
      // Just go back to landing and show a success message.
      toast.success("Requirements gathered successfully!", {
        description: "Project planning module coming soon."
      });
      setCurrentScreen("landing");
    }
  };

  const handleBackToLanding = () => {
    setCurrentScreen("landing");
    setCurrentProject(null);
  };

  const handleOpenProfile = () => {
    setCurrentScreen("profile");
  };

  const handleProfileUpdate = (
    onboardingData: OnboardingData,
  ) => {
    if (user) {
      setUser({ ...user, onboarding: onboardingData });
    }
    setCurrentScreen("landing");
  };

  return (
    <>
      <div className="min-h-screen bg-white">
        {currentScreen === "login" && (
          <LoginScreen onLogin={handleLogin} />
        )}
        {currentScreen === "onboarding" && user && (
          <OnboardingScreen
            userName={user.name}
            onComplete={handleOnboardingComplete}
          />
        )}
        {currentScreen === "landing" && user && (
          <LandingPage
            user={user}
            onStartCourse={handleStartCourse}
            onStartCustomProject={handleStartCustomProject}
            onOpenProfile={handleOpenProfile}
          />
        )}
        {currentScreen === "course" && user && (
          <CoursePage
            user={user}
            onBack={handleBackToLanding}
          />
        )}
        {currentScreen === "customProjectChat" && user && (
          <CustomProjectChat
            user={user}
            onProjectCreated={handleProjectCreated}
            onBack={handleBackToLanding}
          />
        )}
        {currentScreen === "projectWorkspace" &&
          user &&
          currentProject && (
            <ProjectWorkspace
              user={user}
              project={currentProject}
              onBack={handleBackToLanding}
              onComplete={handleBackToLanding}
            />
          )}
        {currentScreen === "profile" && user && (
          <ProfilePage
            user={user}
            onUpdate={handleProfileUpdate}
            onBack={handleBackToLanding}
          />
        )}
      </div>
      <Toaster />
    </>
  );
}