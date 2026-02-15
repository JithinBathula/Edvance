import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, Target, AlertCircle, CheckCircle2, Users, MessageSquare, BookOpen } from 'lucide-react';
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
  Cell,
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

function getCompletionColor(rate: number): string {
  if (rate >= 75) return '#10b981'; // green
  if (rate >= 25) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

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

  const assignmentChartData = (analytics.assignment_analytics || []).map((a) => ({
    title: a.title.length > 25 ? a.title.slice(0, 22) + '...' : a.title,
    fullTitle: a.title,
    completed: a.completed,
    total: a.total,
    rate: a.total > 0 ? Math.round((a.completed / a.total) * 100) : 0,
    onTimeRate: a.total > 0 && a.due_date ? Math.round((a.on_time_count / a.total) * 100) : null,
  }));

  return (
    <div className="space-y-6">
      {/* Students Needing Help Alert */}
      {analytics.students_needing_help.length > 0 && (
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time Per Task</CardTitle>
            <Clock className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.project_stats.avg_time_per_task_hours.toFixed(1)}h
            </div>
            <p className="text-xs text-gray-600 mt-1">Average across all tasks</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Assignment Performance */}
      {assignmentChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-600" />
              Assignment Performance
            </CardTitle>
            <CardDescription>
              Per-assignment completion rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, assignmentChartData.length * 50 + 40)}>
              <BarChart
                data={assignmentChartData}
                layout="vertical"
                margin={{ left: 20, right: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={160}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Completion']}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload as typeof assignmentChartData[number] | undefined;
                    return item ? `${item.fullTitle} (${item.completed}/${item.total})` : _label;
                  }}
                />
                <Bar dataKey="rate" radius={[0, 8, 8, 0]}>
                  {assignmentChartData.map((entry, index) => (
                    <Cell key={index} fill={getCompletionColor(entry.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {assignmentChartData.some((a) => a.onTimeRate !== null) && (
              <div className="mt-4 space-y-2">
                {analytics.assignment_analytics
                  .filter((a) => a.due_date)
                  .map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 truncate max-w-[60%]">{a.title}</span>
                      <span className="text-gray-500">
                        On-time: {a.total > 0 ? Math.round((a.on_time_count / a.total) * 100) : 0}%
                        {a.avg_completion_hours !== null && (
                          <span className="ml-3">Avg: {a.avg_completion_hours}h</span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Usage Card */}
      {analytics.ai_usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-teal-600" />
              AI Tutor Usage
            </CardTitle>
            <CardDescription>
              How students are using the AI assistant
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* XP Leaderboard */}
      <Card>
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
              margin={{ left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="student_name"
                width={100}
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
  );
}
