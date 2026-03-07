import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Star, Target, CheckCircle2, Users, MessageSquare, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
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

/* ── Student struggle row — shows LLM summary of why student struggles ── */
function StudentStruggleRow({
  studentName,
  summary,
  taskNumber,
  projectName,
}: {
  studentName: string;
  summary?: string | null;
  taskNumber?: string | null;
  projectName?: string | null;
}) {
  return (
    <div className="px-4 py-3 flex gap-3">
      <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0 mt-0.5">
        {studentName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-800">{studentName}</p>
          {taskNumber && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              Project {projectName} Task {taskNumber}
            </span>
          )}
        </div>
        {summary ? (
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No evidence recorded yet.</p>
        )}
      </div>
    </div>
  );
}

interface StudentWeakConcept {
  concept: string;
  student_count: number;
  students: string[];
  student_summaries: Record<string, string>;  
  student_task_numbers: Record<string, string>;
  student_project_names: Record<string, string>;
}

interface AnalyticsTabProps {
  analytics: Analytics | null;
  studentCount?: number;
  students?: { id: string; name: string }[];
}

export function AnalyticsTab({ analytics, studentCount, students = [] }: AnalyticsTabProps) {
  const topStruggles = (analytics?.class_struggles ?? []).slice(0, 5);
  const [selectedConcept, setSelectedConcept] = useState<StudentWeakConcept | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
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
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs text-gray-600">
                            {q.student_name} · {q.project_title}
                          </p>
                          {q.task_number && (
                            <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                              Task {q.task_number}
                            </span>
                          )}
                        </div>
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

        {/* Class Struggles */}
        <Card className={!analytics.ai_usage ? 'lg:col-span-2 h-full' : 'h-full'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Class Struggles
            </CardTitle>
            <CardDescription>
              Concepts students are repeatedly struggling with
              <p className="text-xs text-gray-500 mt-1">
              Ranked by concepts that the most students are struggling with. Click a bar for more information.              
              </p>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topStruggles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                <AlertTriangle className="h-8 w-8 text-gray-200" />
                <p className="text-sm">No struggle patterns detected yet</p>
                <p className="text-xs text-gray-400">Appears once students have struggled with a concept more than once</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(240, topStruggles.length * 52)}>
                <BarChart
                  data={topStruggles}
                  layout="vertical"
                  margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    domain={[0, studentCount ?? 'dataMax']}
                    ticks={studentCount ? Array.from({ length: studentCount + 1 }, (_, i) => i) : undefined}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Students', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#9ca3af' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="concept"
                    width={140}
                    tick={{ fontSize: 12, fill: '#374151' }}
                    tickFormatter={(v) => v.length > 20 ? v.slice(0, 18) + '…' : v}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { concept: string; student_count: number; students: string[] };
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
                          <p className="font-semibold text-gray-900 capitalize mb-1">{d.concept}</p>
                          <p className="text-sm text-gray-600 mb-2">{d.student_count} student{d.student_count !== 1 ? 's' : ''} struggling</p>
                          <div className="flex flex-wrap gap-1">
                            {d.students.map((name) => (
                              <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="student_count"
                    fill="url(#colorStruggle)"
                    radius={[0, 6, 6, 0]}
                    label={{ position: 'right', fontSize: 12, fill: '#6b7280', formatter: (v: number) => v }}
                    cursor="pointer"
                    onClick={(data) => setSelectedConcept(
                      selectedConcept?.concept === data.concept ? null : data as StudentWeakConcept
                    )}
                  />
                  <defs>
                    <linearGradient id="colorStruggle" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#fb923c" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Expandable student detail panel — populated from stored summaries */}
            {selectedConcept && (
              <div className="mt-4 border border-orange-200 rounded-xl bg-orange-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200">
                  <div>
                    <p className="font-semibold text-gray-900 capitalize">{selectedConcept.concept}</p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      {selectedConcept.student_count} student{selectedConcept.student_count !== 1 ? 's' : ''} struggling
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedConcept(null)}
                    className="p-1 rounded hover:bg-orange-100 text-orange-400 hover:text-orange-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Student pills — click to expand summary */}
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {selectedConcept.students.map((studentName) => {
                    const isSelected = selectedStudent === studentName;
                    return (
                      <button
                        key={studentName}
                        title={studentName}
                        onClick={() => setSelectedStudent(isSelected ? null : studentName)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          isSelected
                            ? 'bg-orange-500 text-white ring-2 ring-orange-500 ring-offset-2'
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200 transition-duration-200 cursor-auto pointer-events-auto'
                        }`}
                      >
                        {studentName.charAt(0).toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                {/* Expanded summary for selected student */}
                {selectedStudent && (
                  <div className="border-t border-orange-200">
                    <StudentStruggleRow
                      studentName={selectedStudent}
                      summary={selectedConcept.student_summaries?.[selectedStudent] ?? null}
                      taskNumber={selectedConcept.student_task_numbers?.[selectedStudent] ?? null}
                      projectName={selectedConcept.student_project_names?.[selectedStudent] ?? null}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}