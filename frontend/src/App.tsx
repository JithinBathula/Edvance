import { useState, useEffect, useRef } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "./utils/supabase/client";
import { authFetch, setAccessToken } from "./utils/authFetch";
import { LoginScreen } from "./components/LoginScreen";
import { SignupScreen } from "./components/SignupScreen";
import { AuthCallback } from "./components/AuthCallback";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { LandingPage } from "./components/LandingPage";
import { CoursePage } from "./components/CoursePage";
import { ProjectList } from "./components/ProjectList";
import { CustomProjectChat } from "./components/CustomProjectChat";
import { ProjectPlanning } from "./components/ProjectPlanning";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { ProfilePage } from "./components/ProfilePage";
import { StudentDashboard } from "./components/StudentDashboard";
import { BACKEND_URL } from "./utils/constants";

export type OnboardingData = {
  educationLevel: string;        // Primary 5-6, Lower Sec, Upper Sec, JC/Poly/ITE
  schoolExperience: string;      // Scratch, CFF, Upper Sec Computing, Self-taught
  pythonLevel: string;           // Level 1-5 skill assessment
  biggestChallenges: string[];   // Multiple: syntax, steps, bugs, want more
  learningMode: string;          // hold-my-hand, roadmap, challenge-me
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
  const lastProfileFetchTokenRef = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('edvance_user');
    if (!savedUser) return null;
    try {
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem('edvance_user');
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  // Restore project state from localStorage on mount
  const [projectRequirements, setProjectRequirements] = useState<any>(() => {
    const saved = localStorage.getItem('edvance_project_requirements');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentProject, setCurrentProject] = useState<any>(() => {
    const saved = localStorage.getItem('edvance_current_project');
    return saved ? JSON.parse(saved) : null;
  });

  // Fetch profile from backend and set user state
  const fetchAndSetProfile = async ({ timeoutMs = 8000 }: { timeoutMs?: number } = {}): Promise<User | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await authFetch('/auth/me', { signal: controller.signal });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('edvance_user', JSON.stringify(data.user));
        return data.user;
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      clearTimeout(timeoutId);
    }
    return null;
  };

  const fetchProfileOncePerToken = async (token: string | undefined) => {
    if (!token || lastProfileFetchTokenRef.current === token) return;
    lastProfileFetchTokenRef.current = token;
    await fetchAndSetProfile();
  };

  // Initialize Supabase auth session on mount
  useEffect(() => {
    let isMounted = true;

    const clearUserState = () => {
      if (isMounted) {
        setUser(null);
      }
      localStorage.removeItem('edvance_user');
    };

    const initializeSession = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          4000,
          'Supabase session restore'
        );

        if (error) {
          console.error('Failed to restore session:', error);
          setAccessToken(null);
          clearUserState();
          return;
        }

        const session = data.session;
        setAccessToken(session?.access_token ?? null);

        if (session) {
          // Sync profile in background. Do not block app bootstrap on API latency.
          void fetchProfileOncePerToken(session.access_token);
        } else {
          lastProfileFetchTokenRef.current = null;
          clearUserState();
        }
      } catch (err) {
        console.error('Session bootstrap error:', err);
        setAccessToken(null);
        lastProfileFetchTokenRef.current = null;
        clearUserState();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAccessToken(session?.access_token ?? null);

        if (event === 'SIGNED_IN' && session) {
          await fetchProfileOncePerToken(session.access_token);
        } else if (event === 'SIGNED_OUT') {
          lastProfileFetchTokenRef.current = null;
          clearUserState();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setAccessToken(session.access_token);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setAccessToken(null);
      setUser(null);
      setCurrentProject(null);
      setProjectRequirements(null);
      localStorage.removeItem('edvance_user');
      localStorage.removeItem('edvance_current_project');
      localStorage.removeItem('edvance_project_requirements');
      navigate("/", { replace: true });
    };

    window.addEventListener('edvance:auth-expired', handleAuthExpired as EventListener);
    return () => {
      window.removeEventListener('edvance:auth-expired', handleAuthExpired as EventListener);
    };
  }, [navigate]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('edvance_user', JSON.stringify(userData));

    if (userData.onboarding) {
      navigate("/dashboard");
    } else {
      navigate("/onboarding");
    }
  };

  const handleSignup = (userData: User) => {
    setUser(userData);
    localStorage.setItem('edvance_user', JSON.stringify(userData));
    navigate("/onboarding");
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }

    // Clear all localStorage
    localStorage.removeItem('edvance_user');
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
      localStorage.setItem('edvance_user', JSON.stringify(updatedUser));
    }
    navigate("/dashboard");
  };

  const handleRequirementsReady = (data: any) => {
    console.log("Requirements ready:", data);
    const outlineVmType = data?.outline?.vm_type || data?.outline?.vmType;
    const requirements = {
      session: data.session || data.session_data,
      outline: data.outline,
      experienceLevel: data.experienceLevel || user?.onboarding?.pythonLevel || 'beginner',
      vmType: data.vm_type || data.vmType || outlineVmType || 'python',
    };
    setProjectRequirements(requirements);
    localStorage.setItem('edvance_project_requirements', JSON.stringify(requirements));
    navigate("/project-planning");
  };

  const handleProjectReady = (project: any) => {
    console.log("Project ready:", project);
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
            path="/auth/callback"
            element={<AuthCallback />}
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
                  onOpenDashboard={() => navigate("/student-dashboard")}
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
            path="/student-dashboard"
            element={
              <RequireUser>
                <StudentDashboard
                  user={user!}
                  onBack={handleBackToLanding}
                  onSelectProject={handleProjectReady}
                />
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
