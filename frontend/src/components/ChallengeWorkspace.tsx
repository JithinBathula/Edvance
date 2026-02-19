import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { User } from '../App';
import { authFetch } from '../utils/authFetch';
import { EditorIDE } from './EditorIDE';
import { ProjectFile } from '../types/workspace';
import { OpponentProgressBar } from './student/OpponentProgressBar';
import { Button } from './ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Swords,
  Trophy,
  Zap,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';
import type { ChallengeDetail } from '../types/challenge';

type Props = {
  user: User;
  onBack: () => void;
};

export function ChallengeWorkspace({ user, onBack }: Props) {
  const { challengeId } = useParams<{ challengeId: string }>();

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<'won' | 'lost' | null>(null);
  const [opponentProgress, setOpponentProgress] = useState<OpponentProgress>({
    opponent_line_count: 0,
    opponent_status: 'coding',
    my_line_count: 0,
    my_status: 'coding',
    challenge_status: 'active',
    winner_id: null,
  });
  const filesRef = useRef(files);
  filesRef.current = files;

  // Fetch challenge details
  useEffect(() => {
    if (!challengeId) return;
    (async () => {
      try {
        const res = await authFetch(`/challenges/${challengeId}`);
        const data = await res.json();
        if (data.success && data.challenge) {
          const c = data.challenge as ChallengeDetail;

          // Parse puzzle if it came back as a string (double-encoded JSON)
          if (typeof c.puzzle === 'string') {
            try {
              c.puzzle = JSON.parse(c.puzzle);
            } catch { /* ignore */ }
          }

          setChallenge(c);

          // Set up initial files from puzzle starter code
          const starterCode = c.puzzle?.starter_code || 'def solution():\n    # Your code here\n    pass\n';
          setFiles([{
            name: 'main.py',
            content: starterCode,
            language: 'python',
          }]);
        } else {
          toast.error('Failed to load challenge');
        }
      } catch {
        toast.error('Failed to load challenge');
      } finally {
        setLoading(false);
      }
    })();
  }, [challengeId]);

  // Poll opponent progress every 3 seconds
  useEffect(() => {
    if (!challengeId || !challenge || result) return;
    if (challenge.status !== 'active') return;

    const poll = async () => {
      try {
        const res = await authFetch(`/challenges/${challengeId}/progress`);
        const data = await res.json();
        if (data.success) {
          setOpponentProgress(data);
          if (data.challenge_status === 'completed' && data.winner_id && data.winner_id !== user.id) {
            setResult('lost');
          }
        }
      } catch { /* silent */ }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [challengeId, challenge?.status, result]);

  // Send own line count every 3 seconds
  useEffect(() => {
    if (!challengeId || !challenge || result) return;
    if (challenge.status !== 'active') return;

    const send = () => {
      const code = filesRef.current.map(f => f.content).join('\n');
      const lineCount = code.split('\n').length;
      authFetch(`/challenges/${challengeId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ line_count: lineCount }),
      }).catch(() => {});
    };

    const interval = setInterval(send, 3000);
    return () => clearInterval(interval);
  }, [challengeId, challenge?.status, result]);

  const handleSubmit = async () => {
    if (!challengeId || evaluating) return;
    setEvaluating(true);
    setFeedback(null);

    const code = files.map(f => f.content).join('\n');

    try {
      const res = await authFetch(`/challenges/${challengeId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (data.is_correct) {
        if (data.won) {
          setResult('won');
          toast.success(`You won! +${data.xp_bonus} XP bonus!`);
        } else {
          setResult('lost');
          toast.info('Correct, but your opponent finished first!');
        }
      } else {
        setFeedback(data.feedback || 'Not quite right. Try again!');
        toast.error('Not correct yet — check the feedback');
      }
    } catch {
      toast.error('Submission failed');
    } finally {
      setEvaluating(false);
    }
  };

  const getOpponentName = () => {
    if (!challenge) return 'Opponent';
    return challenge.challenger_id === user.id
      ? challenge.opponent?.name || 'Opponent'
      : challenge.challenger?.name || 'Opponent';
  };

  const myLineCount = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #cffafe, #f0fdfa, #fef3c7)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #cffafe, #f0fdfa, #fef3c7)' }}>
        <div className="text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium mb-2">Challenge not found</p>
          <Button onClick={onBack} variant="outline" size="sm">Go back</Button>
        </div>
      </div>
    );
  }

  const puzzle = challenge.puzzle;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div
        className="px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #fff7ed 50%, #ecfdf5 100%)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-teal-600 transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
            <Swords className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Challenge vs {getOpponentName()}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                challenge.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' :
                challenge.difficulty === 'hard' ? 'bg-red-50 text-red-500' :
                'bg-amber-50 text-amber-600'
              }`}>
                {challenge.difficulty?.charAt(0).toUpperCase() + challenge.difficulty?.slice(1)}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {result === 'won' ? 'You won!' : result === 'lost' ? 'Challenge over' : puzzle?.title || 'First to solve wins'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-semibold text-sm">
            <Zap className="w-4 h-4" />
            +{challenge.xp_bonus} XP at stake
          </div>
          <Button
            onClick={handleSubmit}
            disabled={evaluating || !!result}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md disabled:from-slate-300 disabled:to-slate-400"
          >
            {evaluating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {result ? 'Challenge Over' : 'Submit'}
          </Button>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`px-5 py-4 flex items-center justify-center gap-3 ${
          result === 'won'
            ? 'bg-gradient-to-r from-amber-50 to-emerald-50 border-b border-amber-200'
            : 'bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200'
        }`}>
          {result === 'won' ? (
            <>
              <Trophy className="w-6 h-6 text-amber-500" />
              <span className="text-lg font-bold text-amber-700">You Won!</span>
              <span className="text-sm text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md font-semibold">
                +{challenge.xp_bonus} XP earned
              </span>
            </>
          ) : (
            <>
              <Swords className="w-6 h-6 text-slate-400" />
              <span className="text-lg font-bold text-slate-600">
                {getOpponentName()} won this time
              </span>
              <span className="text-sm text-slate-500">Better luck next time!</span>
            </>
          )}
          <Button onClick={onBack} variant="outline" size="sm" className="ml-4">
            Back to Community
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Task Description Panel */}
          <ResizablePanel defaultSize={30} minSize={20}>
            <div className="h-full flex flex-col bg-white border-r border-slate-100">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-sm font-semibold text-slate-700">Task</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
                {puzzle && (
                  <div className="prose prose-sm max-w-none text-slate-700">
                    {/* Puzzle title */}
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-bold text-slate-800 mb-0">{puzzle.title}</h2>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        challenge.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' :
                        challenge.difficulty === 'hard' ? 'bg-red-50 text-red-500' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {challenge.difficulty?.charAt(0).toUpperCase() + challenge.difficulty?.slice(1)}
                      </span>
                    </div>

                    {/* Puzzle description (markdown) */}
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-[15px]">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed text-[15px]">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        code: ({ inline, children }: any) =>
                          inline ? (
                            <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'linear-gradient(135deg, #f0e6ff, #e8f0ff)', color: '#5b21b6' }}>
                              {children}
                            </code>
                          ) : (
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap mb-3">
                              <code>{children}</code>
                            </pre>
                          ),
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                      }}
                    >
                      {puzzle.description || ''}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Feedback from failed submission */}
                {feedback && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="text-sm font-semibold text-amber-800 mb-1">Feedback</h4>
                    <p className="text-sm text-amber-700 whitespace-pre-wrap">{feedback}</p>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Code Editor Panel */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <div className="h-full">
              <EditorIDE
                files={files}
                onFilesChange={setFiles}
                userId={user.id}
                projectId={challengeId || ''}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Opponent Progress Bar */}
      {challenge.status === 'active' && !result && (
        <OpponentProgressBar
          opponentName={getOpponentName()}
          opponentLineCount={opponentProgress.opponent_line_count}
          opponentStatus={opponentProgress.opponent_status}
          myLineCount={myLineCount}
          xpBonus={challenge.xp_bonus}
        />
      )}
    </div>
  );
}
