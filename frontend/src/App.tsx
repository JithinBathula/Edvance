import { useState } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
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
  id: string;
  name: string;
  onboarding: OnboardingData | null;
  createdAt: string;
  xp: number;
  completedProjects: string[];
  projects?: string[];
};

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [currentProject, setCurrentProject] = useState<any>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
    if (userData.onboarding) {
      navigate("/dashboard");
    } else {
      navigate("/onboarding");
    }
  };

  const handleOnboardingComplete = (onboardingData: OnboardingData) => {
    if (user) {
      setUser({ ...user, onboarding: onboardingData });
    }
    navigate("/dashboard");
  };

  const handleProjectCreated = (data: any) => {
    console.log("📦 Data received from Chat:", data);
    if (data.tasks && Array.isArray(data.tasks)) {
      setCurrentProject(data);
      navigate("/project");
    } else {
      toast.success("Requirements gathered successfully!", {
        description: "Project planning module coming soon.",
      });
      navigate("/dashboard");
    }
  };

  const handleBackToLanding = () => {
    setCurrentProject(null);
    navigate("/dashboard");
  };

  const handleProfileUpdate = (onboardingData: OnboardingData) => {
    if (user) {
      setUser({ ...user, onboarding: onboardingData });
    }
    navigate("/dashboard");
  };

  // Protected route wrapper
  const RequireUser = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/" replace />;
    return <>{children}</>;
  };

  return (
    <>
      <div className="min-h-screen bg-white">
        <Routes>
          <Route path="/" element={<LoginScreen onLogin={handleLogin} />} />
          <Route
            path="/onboarding"
            element={
              <RequireUser>
                <OnboardingScreen user={user!} onComplete={handleOnboardingComplete} />
              </RequireUser>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireUser>
                <LandingPage
                  user={user!}
                  onStartCourse={() => navigate("/course")}
                  onStartCustomProject={() => navigate("/custom-project")}
                  onOpenProfile={() => navigate("/profile")}
                />
              </RequireUser>
            }
          />
          <Route
            path="/course"
            element={
              <RequireUser>
                <CoursePage user={user!} onBack={handleBackToLanding} />
              </RequireUser>
            }
          />
          <Route
            path="/custom-project"
            element={
              <RequireUser>
                <CustomProjectChat
                  user={user!}
                  onProjectCreated={handleProjectCreated}
                  onBack={handleBackToLanding}
                />
              </RequireUser>
            }
          />
          <Route
            path="/project"
            element={
              <RequireUser>
                {currentProject ? (
                  <ProjectWorkspace
                    user={user!}
                    project={currentProject}
                    onBack={handleBackToLanding}
                    onComplete={handleBackToLanding}
                  />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </RequireUser>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireUser>
                <ProfilePage user={user!} onUpdate={handleProfileUpdate} onBack={handleBackToLanding} />
              </RequireUser>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toaster />
    </>
  );
}
