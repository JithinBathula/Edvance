import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Star, Target, AlertCircle, CheckCircle2, Users, MessageSquare } from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { Analytics } from './classroomDetail.types';

interface AnalyticsTabProps {
  analytics: Analytics | null;
}

const REASON_LABELS: Record<string, string> = {
  inactive_5_days: '5+ days inactive',
  low_completion: 'Low progress',
  started_never_completed: 'Stuck on first task',
  no_activity: 'Never started',
};

export function AnalyticsTab({ analytics }: AnalyticsTabProps) {
  if (!analytics) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  const progressDistributionData = [
    { range: '0-25%', count: analytics.progress_distribution['0-25'] || 0 },
    { range: '25-50%', count: analytics.progress_distribution['25-50'] || 0 },
    { range: '50-75%', count: analytics.progress_distribution['50-75'] || 0 },
    { range: '75-100%', count: analytics.progress_distribution['75-100'] || 0 },
  ];

  const topLeaderboard = analytics.xp_leaderboard.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Students Needing Help Alert */}
      {analytics.students_needing_help.length > 0 && analytics.assignment_analytics.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5" />
              Students Needing Help
            </CardTitle>
            <CardDescription className="text-amber-700">
              These students may be stuck or disengaged
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.students_needing_help.map((student, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-amber-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{student.student_name}</p>
                    <p className="text-sm text-gray-600">
                      Stuck on: {student.stuck_on_task}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    {student.reason && REASON_LABELS[student.reason]
                      ? REASON_LABELS[student.reason]
                      : student.days_inactive === -1
                        ? 'No activity'
                        : `${student.days_inactive}d inactive`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards — all 4 slots filled */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg XP Per Student</CardTitle>
            <Star className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.project_stats.avg_xp_per_student.toFixed(1)}
            </div>
            <p className="text-xs text-gray-600 mt-1">Average experience points</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Completion</CardTitle>
            <Target className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.project_stats.total_started > 0
                ? Math.round((analytics.project_stats.total_completed / analytics.project_stats.total_started) * 100)
                : 0}%
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {analytics.project_stats.total_completed} of {analytics.project_stats.total_started} started
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.total_tasks_completed ?? 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">Across all students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students (7d)</CardTitle>
            <Users className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.active_students_7d ?? 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">Completed a task in the last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Progress Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Distribution</CardTitle>
            <CardDescription>
              Student distribution across completion ranges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={progressDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>
              Last 30 days of classroom activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.activity_timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="tasks_completed"
                  stroke="#14b8a6"
                  fill="#14b8a6"
                  fillOpacity={0.6}
                  name="Tasks Completed"
                />
                <Area
                  type="monotone"
                  dataKey="active_students"
                  stroke="#f59e0b"
                  fill="transparent"
                  strokeWidth={2}
                  name="Active Students"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Usage Card */}
        {analytics.ai_usage && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-teal-600" />
                AI Tutor Usage
              </CardTitle>
              <CardDescription>
                How students are using the AI assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.ai_usage.total_questions}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Total Questions Asked</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.ai_usage.total_responses}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Total AI Responses</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.ai_usage.avg_per_student}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Avg Questions per Student</p>
                </div>
              </div>

              <div className="pt-1 border-t">
                <p className="text-sm font-medium text-gray-900 mb-3">Recent questions</p>
                {analytics.ai_usage.recent_questions?.length ? (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {analytics.ai_usage.recent_questions.map((q, idx) => (
                      <div key={`${q.student_name}-${idx}`} className="rounded-md border bg-gray-50 p-3">
                        <p className="text-sm text-gray-900 line-clamp-2">{q.content}</p>
                        <p className="mt-1 text-xs text-gray-600">
                          {q.student_name} · {q.project_title}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No recent questions yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* XP Leaderboard */}
        <Card className={!analytics.ai_usage ? 'lg:col-span-2 h-full' : 'h-full'}>
          <CardHeader>
            <CardTitle>XP Leaderboard</CardTitle>
            <CardDescription>
              Top 10 students by experience points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={topLeaderboard}
                layout="vertical"
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="student_name"
                  width={72}
                />
                <Tooltip />
                <Bar
                  dataKey="xp"
                  fill="url(#colorXp)"
                  radius={[0, 8, 8, 0]}
                />
                <defs>
                  <linearGradient id="colorXp" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0d9488" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
