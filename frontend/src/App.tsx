import { useState, useEffect, useRef, useCallback } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "./utils/supabase/client";
import { authFetch, setAccessToken } from "./utils/authFetch";
import { LoginScreen } from "./components/LoginScreen";
import { SignupScreen } from "./components/SignupScreen";
import { AuthCallback } from "./components/AuthCallback";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { CustomProjectChat } from "./components/CustomProjectChat";
import { StudentLayout } from "./components/student/StudentLayout";
import { ProjectPlanning } from "./components/ProjectPlanning";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { TeacherDashboard } from "./components/teacher/TeacherDashboard";
import { ClassroomDetail } from "./components/teacher/ClassroomDetail";
import { StudentDetail } from "./components/teacher/StudentDetail";
import { TeacherSettings } from "./components/teacher/TeacherSettings";
import { AssignmentCreate } from "./components/teacher/AssignmentCreate";
import { AssignmentDetail } from "./components/teacher/AssignmentDetail";
import { StudentDashboard } from "./components/StudentDashboard";
import { StudentClassesPanel } from "./components/student/StudentClassesPanel";
import { StudentSettingsPanel } from "./components/StudentSettings";
import { ProjectList } from "./components/ProjectList";
import { LandingPage } from "./components/LandingPage";

export type OnboardingData = {
  educationLevel: string;        // Primary 5-6, Lower Sec, Upper Sec, JC/Poly/ITE
  schoolExperience: string;      // Scratch, CFF, Upper Sec Computing, Self-taught
  pythonLevel: string;           // Level 1-5 skill assessment
  biggestChallenges: string[];   // Multiple: syntax, steps, bugs, want more
  learningMode: string;          // hold-my-hand, roadmap, challenge-me
  theme?: string;                // Project theme: finance, gaming, etc.
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
  role: 'student' | 'teacher';
  isAdmin?: boolean;
  profilePictureUrl?: string;
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

  const chatRestartRef = useRef<(() => void) | null>(null);
  const handleRegisterRestart = useCallback((fn: (() => void) | null) => {
    chatRestartRef.current = fn;
  }, []);
  const handleChatRestart = useCallback(() => {
    chatRestartRef.current?.();
  }, []);

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
      navigate("/login", { replace: true });
    };

    window.addEventListener('edvance:auth-expired', handleAuthExpired as EventListener);
    return () => {
      window.removeEventListener('edvance:auth-expired', handleAuthExpired as EventListener);
    };
  }, [navigate]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('edvance_user', JSON.stringify(userData));

    if (!userData.onboarding) {
      navigate("/onboarding");
    } else if (userData.role === 'teacher') {
      navigate("/teacher/dashboard");
    } else {
      navigate("/student-dashboard");
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
    navigate("/login");
  };

  const handleOnboardingComplete = (onboardingData: OnboardingData, role?: 'student' | 'teacher') => {
    if (user) {
      const updatedUser = { ...user, onboarding: onboardingData, role: role || user.role || 'student' };
      setUser(updatedUser);
      localStorage.setItem('edvance_user', JSON.stringify(updatedUser));

      if (updatedUser.role === 'teacher') {
        navigate("/teacher/dashboard");
      } else {
        navigate("/student-dashboard");
      }
    } else {
      navigate("/student-dashboard");
    }
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
    navigate("/student-dashboard");
  };

  const handleProfileUpdate = (onboardingData: OnboardingData) => {
    if (user) {
      const updatedUser = { ...user, onboarding: onboardingData };
      setUser(updatedUser);
      localStorage.setItem('edvance_user', JSON.stringify(updatedUser));
    }
  };

  const handleTeacherUserUpdate = (fields: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...fields };
      setUser(updatedUser);
      localStorage.setItem('edvance_user', JSON.stringify(updatedUser));
    }
  };

  const handleProfilePictureUpdate = (profilePictureUrl: string) => {
    if (user) {
      const updatedUser = { ...user, profilePictureUrl };
      setUser(updatedUser);
      localStorage.setItem('edvance_user', JSON.stringify(updatedUser));
    }
  };

  const RequireUser = ({ children }: { children: React.ReactNode }) => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)'}}>
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-teal-600 mx-auto mb-4" />
            <p className="text-slate-600 text-base">Loading...</p>
          </div>
        </div>
      );
    }
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };

  const RequireTeacher = ({ children }: { children: React.ReactNode }) => {
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
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'teacher') return <Navigate to="/student-dashboard" replace />;
    return <>{children}</>;
  };

  // Show loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #fffbeb, white, #ecfeff)'}}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-slate-600 text-base">Loading...</p>
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
            element={<LandingPage user={user} />}
          />
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to={
                  !user.onboarding ? "/onboarding"
                    : user.role === 'teacher' ? "/teacher/dashboard"
                    : "/student-dashboard"
                } replace />
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
                <SignupScreen onSignup={handleSignup} onSwitchToLogin={() => navigate("/login")} />
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
            path="/custom-project"
            element={
              <RequireUser>
                <StudentLayout user={user!} onLogout={handleLogout} onRestart={handleChatRestart}>
                  <CustomProjectChat
                    user={user!}
                    onProjectCreated={handleRequirementsReady}
                    onBack={() => navigate("/student-dashboard")}
                    embedded
                    onRegisterRestart={handleRegisterRestart}
                  />
                </StudentLayout>
              </RequireUser>
            }
          />
          <Route
            path="/project-planning"
            element={
              <RequireUser>
                {projectRequirements ? (
                  <StudentLayout user={user!} onLogout={handleLogout}>
                    <ProjectPlanning
                      user={user!}
                      requirements={projectRequirements}
                      onProjectReady={handleProjectReady}
                      onBack={() => navigate("/custom-project")}
                    />
                  </StudentLayout>
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
                  <Navigate to="/student-dashboard" replace />
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
                  onLogout={handleLogout}
                />
              </RequireUser>
            }
          />
          <Route
            path="/student/classes"
            element={
              <RequireUser>
                <StudentLayout user={user!} onLogout={handleLogout}>
                  <div className="px-6 py-5 max-w-7xl mx-auto flex-1 overflow-y-auto scrollbar-thin">
                    <StudentClassesPanel user={user!} onSelectProject={handleProjectReady} />
                  </div>
                </StudentLayout>
              </RequireUser>
            }
          />
          <Route
            path="/student/projects"
            element={
              <RequireUser>
                <StudentLayout user={user!} onLogout={handleLogout}>
                  <div className="px-6 py-5 max-w-7xl mx-auto flex-1 overflow-y-auto scrollbar-thin">
                    <ProjectList
                      user={user!}
                      onSelectProject={handleProjectReady}
                      onCreateNew={() => navigate('/custom-project')}
                      onBack={() => navigate('/student-dashboard')}
                      embedded
                    />
                  </div>
                </StudentLayout>
              </RequireUser>
            }
          />
          <Route
            path="/student/settings"
            element={
              <RequireUser>
                <StudentLayout user={user!} onLogout={handleLogout}>
                  <div className="px-6 py-5 flex-1 overflow-y-auto scrollbar-thin">
                    <StudentSettingsPanel
                      user={user!}
                      onLogout={handleLogout}
                      onProfilePictureUpdate={handleProfilePictureUpdate}
                      onProfileUpdate={handleProfileUpdate}
                    />
                  </div>
                </StudentLayout>
              </RequireUser>
            }
          />
          <Route
            path="/teacher/dashboard"
            element={
              <RequireTeacher>
                <TeacherDashboard user={user!} onLogout={handleLogout} />
              </RequireTeacher>
            }
          />
          <Route
            path="/teacher/settings"
            element={
              <RequireTeacher>
                <TeacherSettings user={user!} onUserUpdate={handleTeacherUserUpdate} onLogout={handleLogout} />
              </RequireTeacher>
            }
          />
          <Route
            path="/teacher/classroom/:classroomId"
            element={
              <RequireTeacher>
                <ClassroomDetail user={user!} onLogout={handleLogout} />
              </RequireTeacher>
            }
          />
          <Route
            path="/teacher/classroom/:classroomId/student/:studentId"
            element={
              <RequireTeacher>
                <StudentDetail user={user!} />
              </RequireTeacher>
            }
          />
          <Route
            path="/teacher/create-assignment"
            element={
              <RequireTeacher>
                <AssignmentCreate user={user!} onLogout={handleLogout} />
              </RequireTeacher>
            }
          />
          <Route
            path="/teacher/classroom/:classroomId/assignment/:assignmentId"
            element={
              <RequireTeacher>
                <AssignmentDetail user={user!} />
              </RequireTeacher>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
      <Toaster />
    </>
  );
}
