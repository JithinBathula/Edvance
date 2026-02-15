import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Activity,
  Target,
  LogOut,
  FileText,
} from 'lucide-react';
import { Button } from '../ui/button';

interface TeacherLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

const navItems = [
  { path: '/teacher/dashboard', label: 'Dashboard', icon: Activity },
  { path: '/teacher/create-assignment', label: 'Create Assignment', icon: FileText },
  { path: '/teacher/settings', label: 'Settings', icon: Target },
];

export function TeacherLayout({ children, onLogout }: TeacherLayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <GraduationCap className="mr-2 h-6 w-6 text-teal-600" />
          <span className="bg-gradient-to-r from-teal-600 to-amber-500 bg-clip-text text-xl font-bold text-transparent">
            Edvance
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = pathname === path;
            return (
              <button
                key={path}
                onClick={() => !isActive && navigate(path)}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-teal-50 text-teal-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="mr-3 h-5 w-5" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 p-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
