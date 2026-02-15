import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, Target, AlertCircle } from 'lucide-react';
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
                    {student.days_inactive === -1
                      ? 'No activity'
                      : `${student.days_inactive}d inactive`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
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
