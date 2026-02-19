import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../App';
import { authFetch } from '../../utils/authFetch';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import type { Challenge, ChallengeStatus } from '../../types/challenge';
import {
  Swords,
  Send,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Loader2,
  Play,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  user: User;
};

const STATUS_CONFIG: Record<ChallengeStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
  accepted: { label: 'Accepted', color: 'text-blue-600', bg: 'bg-blue-50' },
  active: { label: 'Live', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  completed: { label: 'Completed', color: 'text-slate-600', bg: 'bg-slate-100' },
  declined: { label: 'Declined', color: 'text-red-500', bg: 'bg-red-50' },
  expired: { label: 'Expired', color: 'text-slate-400', bg: 'bg-slate-50' },
};

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bg: string; xp: number }> = {
  easy: { label: 'Easy', color: 'text-emerald-600', bg: 'bg-emerald-50', xp: 15 },
  medium: { label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50', xp: 25 },
  hard: { label: 'Hard', color: 'text-red-500', bg: 'bg-red-50', xp: 40 },
};

export function CommunityPanel({ user }: Props) {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const fetchRef = useRef(false);

  const fetchChallenges = async () => {
    try {
      const res = await authFetch('/challenges');
      const data = await res.json();
      if (data.success) setChallenges(data.challenges);
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    fetchChallenges();
  }, []);

  const handleSendChallenge = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      const res = await authFetch('/challenges', {
        method: 'POST',
        body: JSON.stringify({ opponent_email: email.trim().toLowerCase(), difficulty }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Challenge sent!');
        setEmail('');
        fetchRef.current = false;
        setLoading(true);
        fetchChallenges();
      } else {
        toast.error(data.error || 'Failed to send challenge');
      }
    } catch {
      toast.error('Failed to send challenge');
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await authFetch(`/challenges/${id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Challenge accepted! Get ready to code!');
        fetchRef.current = false;
        fetchChallenges();
      } else {
        toast.error(data.error || 'Failed to accept');
      }
    } catch {
      toast.error('Failed to accept challenge');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await authFetch(`/challenges/${id}/decline`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Challenge declined');
        fetchRef.current = false;
        fetchChallenges();
      } else {
        toast.error(data.error || 'Failed to decline');
      }
    } catch {
      toast.error('Failed to decline challenge');
    } finally {
      setActionLoading(null);
    }
  };

  const getOpponentName = (c: Challenge) => {
    return c.challenger_id === user.id ? c.opponent?.name : c.challenger?.name;
  };

  const getOpponentInitial = (c: Challenge) => {
    const name = getOpponentName(c);
    return name?.charAt(0)?.toUpperCase() || '?';
  };

  const isIncoming = (c: Challenge) => c.opponent_id === user.id;
  const didWin = (c: Challenge) => c.winner_id === user.id;

  // Categorize challenges
  const incoming = challenges.filter(c => c.status === 'pending' && isIncoming(c));
  const outgoing = challenges.filter(c => c.status === 'pending' && !isIncoming(c));
  const active = challenges.filter(c => c.status === 'active' || c.status === 'accepted');
  const history = challenges.filter(c => ['completed', 'declined', 'expired'].includes(c.status));

  return (
    <div className="space-y-6">
      {/* Hero: Challenge a Friend */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="overflow-hidden border-0 shadow-lg">
          <div
            className="p-6"
            style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #fff7ed 50%, #ecfdf5 100%)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md">
                <Swords className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Challenge a Friend</h2>
                <p className="text-sm text-slate-500">Enter their email to start a 1v1 coding duel</p>
              </div>
            </div>
            {/* Difficulty Selector */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Difficulty</p>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
                  const cfg = DIFFICULTY_CONFIG[d];
                  const isSelected = difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all border-2 cursor-pointer ${
                        isSelected
                          ? `${cfg.bg} ${cfg.color} border-current`
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {cfg.label}
                      <span className="block text-[10px] font-normal mt-0.5 opacity-70">+{cfg.xp} XP</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChallenge(); }}
                  placeholder="friend@email.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                />
              </div>
              <Button
                onClick={handleSendChallenge}
                disabled={!email.trim() || sending}
                className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-5 shadow-md"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-2">Challenge</span>
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                <Zap className="w-3 h-3" />
                Winner gets +{DIFFICULTY_CONFIG[difficulty].xp} XP bonus
              </div>
              <div className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-md">
                <Trophy className="w-3 h-3" />
                Python puzzle, first to solve wins
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Incoming Challenges */}
          {incoming.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4 text-orange-500" />
                Incoming Challenges
              </h3>
              <div className="space-y-2">
                {incoming.map(c => (
                  <Card key={c.id} className="p-4 border border-orange-200 bg-orange-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                          {getOpponentInitial(c)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {getOpponentName(c)} challenged you!
                            {(c as any).difficulty && (
                              <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${DIFFICULTY_CONFIG[(c as any).difficulty as Difficulty]?.bg || ''} ${DIFFICULTY_CONFIG[(c as any).difficulty as Difficulty]?.color || ''}`}>
                                {DIFFICULTY_CONFIG[(c as any).difficulty as Difficulty]?.label || (c as any).difficulty}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            +{c.xp_bonus} XP bonus for winner
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecline(c.id)}
                          disabled={actionLoading === c.id}
                          className="text-red-500 border-red-200 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(c.id)}
                          disabled={actionLoading === c.id}
                          className="bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700"
                        >
                          {actionLoading === c.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Accept
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Active Challenges */}
          {active.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-500" />
                Active Challenges
              </h3>
              <div className="space-y-2">
                {active.map(c => (
                  <Card
                    key={c.id}
                    className="p-4 border border-emerald-200 bg-emerald-50/50 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/challenge/${c.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                          {getOpponentInitial(c)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">vs {getOpponentName(c)}</p>
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live — click to join
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0">
                          <Zap className="w-3 h-3 mr-1" />
                          +{c.xp_bonus} XP
                        </Badge>
                        <Play className="w-5 h-5 text-emerald-500" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Outgoing Pending */}
          {outgoing.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Waiting for Response
              </h3>
              <div className="space-y-2">
                {outgoing.map(c => (
                  <Card key={c.id} className="p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white font-bold text-sm">
                          {getOpponentInitial(c)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Challenged {getOpponentName(c)}</p>
                          <p className="text-xs text-slate-400">Waiting for them to accept...</p>
                        </div>
                      </div>
                      <Badge className={`${STATUS_CONFIG.pending.bg} ${STATUS_CONFIG.pending.color} border-0`}>
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Challenge History */}
          {history.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-slate-400" />
                History
              </h3>
              <div className="space-y-2">
                {history.map(c => (
                  <Card key={c.id} className="p-4 border border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          c.status === 'completed' && didWin(c)
                            ? 'bg-gradient-to-br from-amber-400 to-amber-500'
                            : 'bg-gradient-to-br from-slate-300 to-slate-400'
                        }`}>
                          {c.status === 'completed' && didWin(c) ? (
                            <Trophy className="w-5 h-5" />
                          ) : (
                            getOpponentInitial(c)
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            vs {getOpponentName(c)}
                            {c.status === 'completed' && (
                              <span className={`ml-2 text-xs font-semibold ${didWin(c) ? 'text-amber-600' : 'text-slate-400'}`}>
                                {didWin(c) ? 'Won!' : 'Lost'}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            {c.completed_at
                              ? new Date(c.completed_at).toLocaleDateString()
                              : new Date(c.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${STATUS_CONFIG[c.status].bg} ${STATUS_CONFIG[c.status].color} border-0`}>
                        {STATUS_CONFIG[c.status].label}
                        {c.status === 'completed' && didWin(c) && (
                          <span className="ml-1">+{c.xp_bonus} XP</span>
                        )}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {challenges.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
                <Swords className="w-8 h-8 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No challenges yet</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Enter a friend's email above to send your first coding challenge!
              </p>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
