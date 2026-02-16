import { User } from '../App';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Code2, Sparkles, Rocket, LogOut, Users, LayoutDashboard } from 'lucide-react';
import { JoinClassroom } from './student/JoinClassroom';

type Props = {
  user: User;
  onStartCustomProject: () => void;
  onOpenDashboard?: () => void;
  onLogout?: () => void;
};

export function LandingPage({ user, onStartCustomProject, onOpenDashboard, onLogout }: Props) {

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-orange-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl bg-gradient-to-r from-[#7622e5] to-[#ffa200] bg-clip-text text-transparent">
              Edvance
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Welcome back,</p>
              <p className="font-semibold">{user.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#ffa200] to-[#ff8800] text-white text-sm">
                {user.xp} XP
              </div>
              <JoinClassroom
                trigger={
                  <Button variant="ghost" size="icon" className="rounded-full" title="Join Classroom">
                    <Users className="w-5 h-5" />
                  </Button>
                }
              />
              {onOpenDashboard && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenDashboard}
                  className="rounded-full"
                  title="Dashboard"
                >
                  <LayoutDashboard className="w-5 h-5" />
                </Button>
              )}
              {onLogout && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="rounded-full text-gray-500 hover:text-red-500"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-[#7622e5] mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">Your personalized learning path awaits</span>
          </div>
          <h2 className="text-5xl md:text-6xl mb-6 max-w-4xl mx-auto">
            Learn by{' '}
            <span className="bg-gradient-to-r from-[#7622e5] to-[#ffa200] bg-clip-text text-transparent">
              Building
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Don't just watch tutorials. Create real projects, see tangible results, and build your confidence as a developer.
          </p>
        </div>



        {/* Main CTA */}
        <div className="max-w-xl mx-auto">
          <Card className="p-8 border-2 border-gray-200 hover:border-[#ffa200] transition-all hover:shadow-xl cursor-pointer group bg-white">
            <div className="flex flex-col h-full">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Rocket className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-2xl mb-3">Generate Custom Project</h3>
              <p className="text-gray-600 mb-6 flex-1">
                Have an idea? Our AI will design a project tailored to your skill level with step-by-step tasks to bring it to life.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 rounded-full bg-[#7622e5]"></div>
                  <span>Describe any project idea</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 rounded-full bg-[#7622e5]"></div>
                  <span>AI matches complexity to your level</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 rounded-full bg-[#7622e5]"></div>
                  <span>Guided tasks with hints</span>
                </div>
              </div>

              <Button
                onClick={onStartCustomProject}
                className="w-full bg-gradient-to-r from-[#ffa200] to-[#ff8800] hover:from-[#e69100] hover:to-[#e67700]"
              >
                Create Project
              </Button>
            </div>
          </Card>
        </div>

        {/* Stats Section */}
        {user.completedProjects && user.completedProjects.length > 0 && (
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-8 px-8 py-6 bg-white rounded-2xl shadow-lg border border-gray-100">
              <div>
                <div className="text-3xl mb-1">{user.completedProjects.length}</div>
                <div className="text-sm text-gray-600">Projects Completed</div>
              </div>
              <div className="w-px h-12 bg-gray-200"></div>
              <div>
                <div className="text-3xl mb-1">{user.xp}</div>
                <div className="text-sm text-gray-600">Total XP</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
