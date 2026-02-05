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

  // Restore project state from localStorage on mount
  const [projectRequirements, setProjectRequirements] = useState<any>(() => {
    const saved = localStorage.getItem('edvance_project_requirements');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentProject, setCurrentProject] = useState<any>(() => {
    const saved = localStorage.getItem('edvance_current_project');
    return saved ? JSON.parse(saved) : null;
  });

  // Check for existing session on app load
  useEffect(() => {
    const checkSession = async () => {
      // First, try to restore from localStorage
      const savedUser = localStorage.getItem('edvance_user');
      const sessionExpiry = localStorage.getItem('edvance_session_expiry');

      // Check if localStorage session is still valid (within 1 hour)
      if (savedUser && sessionExpiry) {
        const expiryTime = parseInt(sessionExpiry, 10);
        const now = Date.now();

        if (now < expiryTime) {
          // Session still valid, restore user immediately
          try {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            console.log('✅ Session restored from localStorage');
            setLoading(false);
            return; // Skip backend check if localStorage is valid
          } catch (e) {
            console.error('Failed to parse saved user data');
          }
        } else {
          // Session expired, clear localStorage
          console.log('⏰ Session expired (1 hour), clearing localStorage');
          localStorage.removeItem('edvance_user');
          localStorage.removeItem('edvance_session_expiry');
        }
      }

      // If no valid localStorage session, check backend
      try {
        const response = await fetch(`${BACKEND_URL}/auth/me`, {
          credentials: 'include',
        });
        const data = await response.json();

        if (data.success && data.user) {
          setUser(data.user);

          // Save to localStorage with 1 hour expiry
          const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
          localStorage.setItem('edvance_user', JSON.stringify(data.user));
          localStorage.setItem('edvance_session_expiry', expiryTime.toString());

          console.log('✅ Session verified with backend and saved to localStorage');
        }
      } catch (err) {
        console.log("No existing backend session");
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);

    // Save to localStorage with 1 hour expiry
    const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
    localStorage.setItem('edvance_user', JSON.stringify(userData));
    localStorage.setItem('edvance_session_expiry', expiryTime.toString());

    if (userData.onboarding) {
      navigate("/dashboard");
    } else {
      navigate("/onboarding");
    }
  };

  const handleSignup = (userData: User) => {
    setUser(userData);

    // Save to localStorage with 1 hour expiry
    const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
    localStorage.setItem('edvance_user', JSON.stringify(userData));
    localStorage.setItem('edvance_session_expiry', expiryTime.toString());

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

    // Clear all localStorage
    localStorage.removeItem('edvance_user');
    localStorage.removeItem('edvance_session_expiry');
    localStorage.removeItem('edvance_current_project');
    localStorage.removeItem('edvance_project_requirements');

    setUser(null);
    setCurrentProject(null);
    setProjectRequirements(null);
    navigate("/");
  };

  const handleOnboardingComplete = (onboardingData: OnboardingData) => {
    if (user) {
      const updatedUser = { ...user, onboarding: onboardingData };
      setUser(updatedUser);

      // Update localStorage
      localStorage.setItem('edvance_user', JSON.stringify(updatedUser));
    }
    navigate("/dashboard");
  };

  const handleRequirementsReady = (data: any) => {
    console.log("📋 Requirements ready:", data);
    const outlineVmType = data?.outline?.vm_type || data?.outline?.vmType;
    const requirements = {
      session: data.session || data.session_data,
      outline: data.outline,
      experienceLevel: data.experienceLevel || user?.onboarding?.experienceLevel || 'beginner',
      vmType: data.vm_type || data.vmType || outlineVmType || 'python',
    };
    setProjectRequirements(requirements);
    localStorage.setItem('edvance_project_requirements', JSON.stringify(requirements));
    navigate("/project-planning");
  };

  const handleProjectReady = (project: any) => {
    console.log("📦 Project ready:", project);
    setCurrentProject(project);
    localStorage.setItem('edvance_current_project', JSON.stringify(project));
    navigate("/project");
  };

  const handleBackToLanding = () => {
    setCurrentProject(null);
    setProjectRequirements(null);
    localStorage.removeItem('edvance_current_project');
    localStorage.removeItem('edvance_project_requirements');
    navigate("/dashboard");
  };

  const handleProfileUpdate = (onboardingData: OnboardingData) => {
    if (user) {
      const updatedUser = { ...user, onboarding: onboardingData };
      setUser(updatedUser);

      // Update localStorage
      localStorage.setItem('edvance_user', JSON.stringify(updatedUser));
    }
    navigate("/dashboard");
  };

  const RequireUser = ({ children }: { children: React.ReactNode }) => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
