import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { LoginScreen } from "./components/LoginScreen";
import { SignupScreen } from "./components/SignupScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { LandingPage } from "./components/LandingPage";
import { CoursePage } from "./components/CoursePage";
import { ProjectList } from "./components/ProjectList";
import { CustomProjectChat } from "./components/CustomProjectChat";
import { ProjectPlanning } from "./components/ProjectPlanning";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { ProfilePage } from "./components/ProfilePage";
import { BACKEND_URL } from "./utils/constants";

export type OnboardingData = {
  pythonExperience: string;
  experienceLevel: string;
  goal: string;
  theme: string;
};

export type User = {
  id: string;
  name: string;
  email?: string;
  onboarding: OnboardingData | null;
  createdAt: string;
  xp: number;
  completedProjects: string[];
  projects?: string[];
};

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectRequirements, setProjectRequirements] = useState<any>(null);
  const [currentProject, setCurrentProject] = useState<any>(null);

  // Check for existing session on app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/auth/me`, {
          credentials: 'include',
        });
        const data = await response.json();

        if (data.success && data.user) {
          setUser(data.user);
          // Navigate based on onboarding status
          if (data.user.onboarding) {
            navigate("/dashboard", { replace: true });
          } else {
            navigate("/onboarding", { replace: true });
          }
        }
      } catch (err) {
        console.log("No existing session");
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    if (userData.onboarding) {
      navigate("/dashboard");
    } else {
      navigate("/onboarding");
    }
  };

  const handleSignup = (userData: User) => {
    setUser(userData);
    navigate("/onboarding");
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null);
    navigate("/");
  };

  const handleOnboardingComplete = (onboardingData: OnboardingData) => {
    if (user) {
      setUser({ ...user, onboarding: onboardingData });
    }
    navigate("/dashboard");
  };

  const handleRequirementsReady = (data: any) => {
    console.log("📋 Requirements ready:", data);
    const outlineVmType = data?.outline?.vm_type || data?.outline?.vmType;
    setProjectRequirements({
      session: data.session || data.session_data,
      outline: data.outline,
      experienceLevel: data.experienceLevel || user?.onboarding?.experienceLevel || 'beginner',
      vmType: data.vm_type || data.vmType || outlineVmType || 'python',
    });
    navigate("/project-planning");
  };

  const handleProjectReady = (project: any) => {
    console.log("📦 Project ready:", project);
    setCurrentProject(project);
    navigate("/project");
  };

  const handleBackToLanding = () => {
    setCurrentProject(null);
    setProjectRequirements(null);
    navigate("/dashboard");
  };

  const handleProfileUpdate = (onboardingData: OnboardingData) => {
    if (user) {
      setUser({ ...user, onboarding: onboardingData });
    }
    navigate("/dashboard");
  };

  const RequireUser = ({ children }: { children: React.ReactNode }) => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-orange-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#7622e5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }
    if (!user) return <Navigate to="/" replace />;
    return <>{children}</>;
  };

  // Show loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-orange-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7622e5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-white">
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to={user.onboarding ? "/dashboard" : "/onboarding"} replace />
              ) : (
                <LoginScreen onLogin={handleLogin} onSwitchToSignup={() => navigate("/signup")} />
              )
            }
          />
          <Route
            path="/signup"
            element={
              user ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <SignupScreen onSignup={handleSignup} onSwitchToLogin={() => navigate("/")} />
              )
            }
          />
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
                  onStartCustomProject={() => navigate("/projects")}
                  onOpenProfile={() => navigate("/profile")}
                  onLogout={handleLogout}
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
            path="/projects"
            element={
              <RequireUser>
                <ProjectList
                  user={user!}
                  onSelectProject={handleProjectReady}
                  onCreateNew={() => navigate("/custom-project")}
                  onBack={handleBackToLanding}
                />
              </RequireUser>
            }
          />
          <Route
            path="/custom-project"
            element={
              <RequireUser>
                <CustomProjectChat
                  user={user!}
                  onProjectCreated={handleRequirementsReady}
                  onBack={() => navigate("/projects")}
                />
              </RequireUser>
            }
          />
          <Route
            path="/project-planning"
            element={
              <RequireUser>
                {projectRequirements ? (
                  <ProjectPlanning
                    user={user!}
                    requirements={projectRequirements}
                    onProjectReady={handleProjectReady}
                    onBack={() => navigate("/custom-project")}
                  />
                ) : (
                  <Navigate to="/custom-project" replace />
                )}
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
