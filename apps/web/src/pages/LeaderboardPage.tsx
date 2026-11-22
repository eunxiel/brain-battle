import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { LeaderboardEntry, LeaderboardPeriod } from '@brain-battle/shared';
import { Avatar } from '../design/Avatar';
import { Button } from '../design/Button';
import { Card } from '../design/Card';
import { EmptyState, Skeleton } from '../design/Feedback';
import { Icon } from '../design/Icon';
import { PageShell } from '../design/Shell';
import { TopBar } from '../components/TopBar';
import { play } from '../audio/sfx';
import { request } from '../net/socket';
import { useSessionStore } from '../store/session';

const PERIODS: { id: LeaderboardPeriod; label: string; icon: string }[] = [
  { id: 'daily', label: 'Today', icon: 'flame' },
  { id: 'weekly', label: 'This week', icon: 'clock' },
  { id: 'all-time', label: 'All time', icon: 'trophy' },
];

export function LeaderboardPage() {
  const navigate = useNavigate();
  const myId = useSessionStore((s) => s.profile?.id);
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    setEntries(null);
    void request<LeaderboardEntry[]>('leaderboard:get', { period }).then((res) => {
      if (active) setEntries(res.ok ? res.data : []);
    });
    return () => {
      active = false;
    };
  }, [period]);

  const podium = entries?.slice(0, 3) ?? [];
  const rest = entries?.slice(3) ?? [];
  const myEntry = entries?.find((e) => e.playerId === myId);

  return (
    <>
      <TopBar />
      <PageShell width="max-w-3xl" className="space-y-5">
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" icon="back" size="sm" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>

        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Leaderboard</h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            Best single-match score. Daily Challenge runs count too.
          </p>
        </div>

        {/* Period tabs */}
        <div className="mx-auto flex w-fit gap-1 rounded-2xl bg-white p-1.5 shadow-soft">
          {PERIODS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                play('click');
                setPeriod(tab.id);
              }}
              className={clsx(
                'relative flex items-center gap-1.5 rounded-xl px-4 py-2 font-display text-sm font-bold transition-colors no-select',
                period === tab.id ? 'text-white' : 'text-ink-soft hover:text-ink',
              )}
            >
              {period === tab.id && (
                <motion.span
                  layoutId="period-pill"
                  className="absolute inset-0 rounded-xl bg-violet"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon name={tab.icon} size={15} />
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {entries === null && (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {entries?.length === 0 && (
          <Card padding="lg">
            <EmptyState
              icon="trophy"
              title="Nobody on the board yet"
              description="Be the first to post a score for this period."
              action={
                <Button className="mt-2" icon="play" onClick={() => navigate('/play')}>
                  Play a match
                </Button>
              }
            />
          </Card>
        )}

        {/* Podium */}
        {podium.length > 0 && (
          <div className="grid grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((index) => {
              const entry = podium[index];
              if (!entry) return <div key={index} />;
              const heights = ['h-28', 'h-36', 'h-24'];
              const colors = ['bg-sky-200', 'bg-sun', 'bg-coral-200'];
              const order = [1, 0, 2].indexOf(index);
              return (
                <motion.div
                  key={entry.playerId}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: order * 0.08 }}
                  className="flex flex-col items-center"
                >
                  <Avatar
                    avatarId={entry.avatarId}
                    size={index === 0 ? 62 : 50}
                    ring={index === 0 ? 'var(--color-sun)' : undefined}
                  />
                  <div className="mt-2 max-w-full truncate px-1 text-center font-display text-sm font-bold text-ink">
                    {entry.username}
                  </div>
                  <div className="font-display text-lg font-bold text-violet">
                    {entry.score.toLocaleString()}
                  </div>
                  <div
                    className={clsx(
                      'mt-2 grid w-full place-items-start justify-center rounded-t-2xl pt-3 font-display text-2xl font-bold text-ink/70',
                      heights[index],
                      colors[index],
                    )}
                  >
                    {entry.rank}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Remaining ranks */}
        {rest.length > 0 && (
          <Card padding="sm">
            <div className="divide-y-2 divide-mist">
              {rest.map((entry) => (
                <Row key={entry.playerId} entry={entry} me={entry.playerId === myId} />
              ))}
            </div>
          </Card>
        )}

        {myEntry && myEntry.rank > 3 && (
          <div className="sticky bottom-3">
            <Card padding="sm" className="!border-violet/30 bg-violet-soft">
              <Row entry={myEntry} me />
            </Card>
          </div>
        )}
      </PageShell>
    </>
  );
}

function Row({ entry, me }: { entry: LeaderboardEntry; me: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 text-center font-display text-base font-bold text-ink-faint">
        {entry.rank}
      </div>
      <Avatar avatarId={entry.avatarId} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-[15px] font-bold text-ink">
            {entry.username}
          </span>
          {me && (
            <span className="rounded-full bg-violet px-2 py-0.5 text-[10px] font-bold text-white">
              YOU
            </span>
          )}
        </div>
        <div className="text-[11px] font-semibold text-ink-faint">
          Level {entry.level} · {entry.matches} matches · {entry.wins} wins
        </div>
      </div>
      <div className="font-display text-lg font-bold text-violet tabular-nums">
        {entry.score.toLocaleString()}
      </div>
    </div>
  );
}
