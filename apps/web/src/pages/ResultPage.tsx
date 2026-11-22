import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS, TOTAL_ROUNDS, type MatchResultPlayer } from '@brain-battle/shared';
import { Avatar } from '../design/Avatar';
import { Button } from '../design/Button';
import { Card, Pill } from '../design/Card';
import { Icon } from '../design/Icon';
import { PageShell } from '../design/Shell';
import { StatTile } from '../design/Stats';
import { play } from '../audio/sfx';
import { useGameStore } from '../store/game';
import { useSessionStore } from '../store/session';

export function ResultPage() {
  const navigate = useNavigate();
  const result = useGameStore((s) => s.result);
  const room = useGameStore((s) => s.room);
  const clearResult = useGameStore((s) => s.clearResult);
  const resetMatch = useGameStore((s) => s.resetMatch);
  const startSolo = useGameStore((s) => s.startSolo);
  const refreshBundle = useSessionStore((s) => s.refreshBundle);
  const myId = useSessionStore((s) => s.profile?.id ?? '');

  const me = result?.players.find((p) => p.playerId === myId) ?? result?.players[0] ?? null;
  const them = result?.players.find((p) => p.playerId !== myId) ?? null;
  const solo = (result?.players.length ?? 0) === 1;

  const verdict = useMemo(() => {
    if (!result || !me) return null;
    if (result.mode === 'coop') {
      return result.teamVictory
        ? { title: 'TEAM VICTORY', tone: 'mint' as const, icon: 'handshake', sub: 'You cleared all 12 rounds together.' }
        : { title: 'MISSION FAILED', tone: 'coral' as const, icon: 'heart', sub: 'The team ran out of lives. Run it back?' };
    }
    if (solo) {
      return result.reason === 'completed'
        ? { title: 'RUN COMPLETE', tone: 'mint' as const, icon: 'flag', sub: 'All 12 rounds survived.' }
        : { title: 'RUN OVER', tone: 'coral' as const, icon: 'heart', sub: 'You ran out of lives.' };
    }
    if (!result.winnerId) {
      return { title: 'DRAW', tone: 'sun' as const, icon: 'swords', sub: 'Dead even. Rematch?' };
    }
    return result.winnerId === me.playerId
      ? { title: 'VICTORY', tone: 'mint' as const, icon: 'crown', sub: 'You out-thought your rival.' }
      : { title: 'DEFEAT', tone: 'coral' as const, icon: 'swords', sub: 'So close. Go again?' };
  }, [result, me, solo]);

  useEffect(() => {
    if (!verdict) return;
    play(verdict.tone === 'mint' ? 'win' : verdict.tone === 'sun' ? 'reveal' : 'lose');
    void refreshBundle();
  }, [verdict, refreshBundle]);

  useEffect(() => {
    if (!result) navigate('/', { replace: true });
  }, [result, navigate]);

  if (!result || !me || !verdict) return null;

  const accuracy = me.correct + me.wrong > 0
    ? Math.round((me.correct / (me.correct + me.wrong)) * 100)
    : 0;

  const unlocked = ACHIEVEMENTS.filter((a) => result.unlockedAchievements.includes(a.id));
  const toneClass = {
    mint: 'bg-mint',
    coral: 'bg-coral',
    sun: 'bg-sun',
  }[verdict.tone];

  const playAgain = async (): Promise<void> => {
    play('click');
    clearResult();
    resetMatch();
    if (solo) {
      const started = await startSolo();
      if (started) navigate('/arena');
      return;
    }
    navigate(room ? '/room' : '/play');
  };

  const goHome = (): void => {
    play('click');
    clearResult();
    resetMatch();
    navigate('/');
  };

  return (
    <PageShell width="max-w-3xl" className="space-y-5 pt-6">
      {/* Verdict */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className={clsx(
          'relative overflow-hidden rounded-[32px] border-2 border-white p-7 text-center text-white shadow-pop',
          toneClass,
          verdict.tone === 'sun' && '!text-ink',
        )}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-white/12" />
        <div className="pointer-events-none absolute -bottom-24 -left-14 h-52 w-52 rounded-full bg-white/10" />

        <motion.div
          initial={{ scale: 0.4, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
          className="relative mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-white/25 backdrop-blur-sm"
        >
          <Icon name={verdict.icon} size={40} />
        </motion.div>

        <h1 className="relative mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {verdict.title}
        </h1>
        <p className="relative mt-1.5 text-sm font-semibold opacity-85">{verdict.sub}</p>

        {/* Scores */}
        <div className="relative mt-6 flex items-center justify-center gap-4 sm:gap-8">
          <ResultPlayer player={me} label="You" winner={result.winnerId === me.playerId} />
          {them && (
            <>
              <div className="font-display text-xl font-bold opacity-70">
                {result.mode === 'coop' ? '+' : 'VS'}
              </div>
              <ResultPlayer
                player={them}
                label={them.username}
                winner={result.winnerId === them.playerId}
              />
            </>
          )}
        </div>

        {result.mode === 'coop' && result.teamScore !== null && (
          <div className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-white/25 px-5 py-2 backdrop-blur-sm">
            <Icon name="handshake" size={18} />
            <span className="font-display text-lg font-bold">
              Team score {result.teamScore.toLocaleString()}
            </span>
          </div>
        )}
      </motion.div>

      {/* Performance */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-semibold text-ink">Performance summary</h2>
          <Pill tone="violet">
            {result.roundsPlayed}/{TOTAL_ROUNDS} rounds
          </Pill>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon="star" label="Score" value={me.score.toLocaleString()} tone="violet" />
          <StatTile icon="check" label="Correct" value={me.correct} tone="mint" />
          <StatTile icon="close" label="Wrong" value={me.wrong} tone="coral" />
          <StatTile icon="target" label="Accuracy" value={`${accuracy}%`} tone="sky" />
          <StatTile
            icon="clock"
            label="Avg time"
            value={me.avgResponseMs ? `${(me.avgResponseMs / 1000).toFixed(2)}s` : '—'}
            tone="sun"
          />
          <StatTile icon="flame" label="Best streak" value={me.bestStreak} tone="coral" />
        </div>
      </section>

      {/* XP + achievements */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet text-white">
              <Icon name="rocket" size={22} />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-ink">+{me.xpGained} XP</div>
              <div className="text-xs font-semibold text-ink-faint">
                Earned from this {result.mode === 'coop' ? 'co-op run' : solo ? 'daily run' : 'match'}
              </div>
            </div>
          </div>

          {unlocked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {unlocked.map((achievement) => (
                <motion.div
                  key={achievement.id}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                  className="flex items-center gap-2 rounded-2xl bg-sun-soft px-3 py-2"
                >
                  <Icon name={achievement.icon} size={18} className="text-sun-deep" />
                  <div className="leading-tight">
                    <div className="font-display text-sm font-bold text-ink">{achievement.title}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-sun-deep">
                      Unlocked
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {result.reason === 'disconnect' && (
        <div className="rounded-2xl bg-sun-soft px-4 py-3 text-center text-sm font-bold text-sun-deep">
          The match ended early because a player lost connection.
        </div>
      )}

      <div className="flex flex-col gap-3 pb-4 sm:flex-row">
        <Button size="lg" fullWidth icon="refresh" onClick={() => void playAgain()}>
          Play again
        </Button>
        <Button size="lg" fullWidth variant="outline" icon="home" onClick={goHome}>
          Back to home
        </Button>
      </div>
    </PageShell>
  );
}

function ResultPlayer({
  player,
  label,
  winner,
}: {
  player: MatchResultPlayer;
  label: string;
  winner: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar avatarId={player.avatarId} size={64} />
        {winner && (
          <motion.span
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute -top-5 left-1/2 -translate-x-1/2 text-sun"
          >
            <Icon name="crown" size={24} className="fill-sun" />
          </motion.span>
        )}
      </div>
      <div className="max-w-24 truncate font-display text-sm font-bold">{label}</div>
      <div className="font-display text-2xl font-bold tabular-nums">
        {player.score.toLocaleString()}
      </div>
    </div>
  );
}
