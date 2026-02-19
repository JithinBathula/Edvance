import { Zap, User as UserIcon } from 'lucide-react';

type Props = {
  opponentName: string;
  opponentLineCount: number;
  opponentStatus: 'coding' | 'submitted' | 'completed';
  myLineCount: number;
  xpBonus: number;
};

export function OpponentProgressBar({
  opponentName,
  opponentLineCount,
  opponentStatus,
  myLineCount,
  xpBonus,
}: Props) {
  const maxLines = Math.max(opponentLineCount, myLineCount, 1);
  const opponentPercent = Math.min((opponentLineCount / maxLines) * 100, 100);
  const myPercent = Math.min((myLineCount / maxLines) * 100, 100);

  return (
    <div className="bg-white/95 backdrop-blur border-t border-slate-200 px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Opponent info */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-xs">
            {opponentName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{opponentName}</p>
            <p className="text-xs text-slate-400">
              {opponentStatus === 'completed'
                ? 'Finished!'
                : opponentStatus === 'submitted'
                ? 'Submitting...'
                : `${opponentLineCount} lines written`}
            </p>
          </div>
        </div>

        {/* Progress comparison */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-teal-600 font-medium w-8 text-right">You</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${myPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 w-10">{myLineCount} ln</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-orange-500 font-medium w-8 text-right truncate">{opponentName.split(' ')[0]}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-300 to-orange-400 rounded-full transition-all duration-500"
                style={{ width: `${opponentPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 w-10">{opponentLineCount} ln</span>
          </div>
        </div>

        {/* Blurred code visual */}
        <div className="w-32 h-10 bg-slate-100 rounded-lg overflow-hidden relative hidden sm:block">
          <div className="absolute inset-0 px-2 py-1 font-mono text-[8px] text-slate-300 leading-tight blur-[2px] select-none">
            {Array.from({ length: Math.min(opponentLineCount, 6) }, (_, i) => (
              <div key={i} className="truncate">
                {'x'.repeat(Math.floor(Math.random() * 25 + 8))}
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/60" />
          {opponentStatus === 'completed' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <span className="text-xs font-semibold text-red-500">Finished!</span>
            </div>
          )}
        </div>

        {/* XP bonus */}
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-semibold text-sm shrink-0">
          <Zap className="w-4 h-4" />
          +{xpBonus} XP
        </div>
      </div>
    </div>
  );
}
