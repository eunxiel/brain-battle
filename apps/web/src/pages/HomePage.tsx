import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ACHIEVEMENTS,
  MINI_GAME_LIST,
  STARTING_LIVES,
  TOTAL_ROUNDS,
  getMiniGame,
  levelForXp,
  xpForLevel,
  type LeaderboardEntry,
} from '@brain-battle/shared';
import { Avatar } from '../design/Avatar';
import { Button } from '../design/Button';
import { Card, Pill, SectionTitle, TapCard } from '../design/Card';
import { ProgressBar, Skeleton } from '../design/Feedback';
import { Icon } from '../design/Icon';
import { PageShell } from '../design/Shell';
import { StatTile } from '../design/Stats';
import { accentOf } from '../design/tokens';
import { HeroArt } from '../components/HeroArt';
import { TopBar } from '../components/TopBar';
import { play } from '../audio/sfx';
import { request } from '../net/socket';
import { useGameStore } from '../store/game';
import { useSessionStore } from '../store/session';

export function HomePage() {
  const navigate = useNavigate();
  const profile = useSessionStore((s) => s.profile);
  const daily = useSessionStore((s) => s.daily);
  const refreshBundle = useSessionStore((s) => s.refreshBundle);
  const startSolo = useGameStore((s) => s.startSolo);
  const [top, setTop] = useState<LeaderboardEntry[] | null>(null);
  const [startingDaily, setStartingDaily] = useState(false);

  useEffect(() => {
    void refreshBundle();
    void request<LeaderboardEntry[]>('leaderboard:get', { period: 'daily' }).then((res) => {
      if (res.ok) setTop(res.data.slice(0, 3));
    });
  }, [refreshBundle]);

  if (!profile) return null;

  const level = levelForXp(profile.xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const winRate = profile.totalMatches
    ? Math.round((profile.wins / profile.totalMatches) * 100)
    : 0;

  const unlocked = ACHIEVEMENTS.filter((a) => profile.achievements.includes(a.id)).slice(-4);
  const nextUp = ACHIEVEMENTS.filter((a) => !profile.achievements.includes(a.id)).slice(0, 4);

  const onDaily = async (): Promise<void> => {
    play('start');
    setStartingDaily(true);
    const started = await startSolo();
    setStartingDaily(false);
    if (started) navigate('/arena');
  };

  return (
    <>
      <TopBar />
      <PageShell className="space-y-5">
        {/* ------------------------------------------------------------ HERO */}
        <section className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <Card
            padding="lg"
            tone="none"
            className="relative overflow-hidden !border-violet-deep/20 bg-violet text-white"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-white/10" />

            <div className="relative">
              <Pill tone="violet" className="!bg-white/20 !text-white backdrop-blur-sm">
                <Icon name="bolt" size={13} />
                {TOTAL_ROUNDS} rounds · {STARTING_LIVES} lives · {MINI_GAME_LIST.length} mini-games
              </Pill>

              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] text-balance sm:text-5xl">
                Train your brain.
                <br />
                Out-think your rival.
              </h1>
              <p className="mt-3 max-w-md text-[15px] font-medium text-white/80">
                Memory, logic, reflexes and maths — twelve lightning rounds against a real opponent.
                Think fast, play smart, win together.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  size="xl"
                  variant="sun"
                  icon="play"
                  onClick={() => {
                    play('pop');
                    navigate('/play');
                  }}
                >
                  PLAY NOW
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  icon="users"
                  className="!bg-white/15 !text-white hover:!bg-white/25"
                  onClick={() => {
                    play('click');
                    useGameStore.getState().setMode('versus');
                    navigate('/lobby');
                  }}
                >
                  Play with a friend
                </Button>
              </div>
            </div>
          </Card>

          <Card padding="md" className="grid place-items-center">
            <HeroArt />
          </Card>
        </section>

        {/* -------------------------------------------------- DAILY + RANKING */}
        <section className="grid gap-5 md:grid-cols-2">
          <Card padding="lg" className="relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sun-soft" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Pill tone="sun">
                    <Icon name="flame" size={13} />
                    Daily Challenge
                  </Pill>
                  <h2 className="mt-3 font-display text-2xl font-bold text-ink">
                    Today&rsquo;s brain run
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    Solo, {TOTAL_ROUNDS} rounds. Same line-up for every player today.
                  </p>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sun text-ink shadow-soft">
                  <span className="font-display text-xl font-bold">
                    {daily?.streak ?? 0}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {(daily?.gameIds ?? []).slice(0, 6).map((id, index) => {
                  const game = getMiniGame(id);
                  const accent = accentOf(game.accent);
                  return (
                    <div
                      key={`${id}-${index}`}
                      className="grid h-9 w-9 place-items-center rounded-xl"
                      style={{ background: accent.soft, color: accent.hex }}
                      title={game.title}
                    >
                      <Icon name={game.icon} size={17} />
                    </div>
                  );
                })}
                {(daily?.gameIds?.length ?? 0) > 6 && (
                  <span className="text-xs font-bold text-ink-faint">
                    +{(daily?.gameIds.length ?? 0) - 6}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    Your best today
                  </div>
                  <div className="font-display text-2xl font-bold text-ink">
                    {(daily?.bestScore ?? 0).toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="sun"
                  size="lg"
                  icon={daily?.completed ? 'refresh' : 'play'}
                  loading={startingDaily}
                  onClick={() => void onDaily()}
                >
                  {daily?.completed ? 'Beat it' : 'Start run'}
                </Button>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <SectionTitle
              icon="trophy"
              title="Today's leaderboard"
              action={
                <button
                  className="-my-2 -mr-2 flex items-center gap-1 rounded-full px-2 py-2 text-xs font-bold text-violet"
                  onClick={() => {
                    play('click');
                    navigate('/leaderboard');
                  }}
                >
                  See all <Icon name="chevron" size={14} />
                </button>
              }
            />
            <div className="space-y-2">
              {top === null && (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              )}
              {top?.length === 0 && (
                <div className="rounded-2xl bg-mist p-5 text-center">
                  <p className="font-display font-semibold text-ink">No scores yet today</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Play the Daily Challenge and claim rank #1.
                  </p>
                </div>
              )}
              {top?.map((entry) => (
                <LeaderRow key={entry.playerId} entry={entry} highlight={entry.playerId === profile.id} />
              ))}
            </div>
          </Card>
        </section>

        {/* ----------------------------------------------------------- STATS */}
        <section>
          <SectionTitle icon="user" title="Your progress" />
          <Card padding="md">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <button
                className="flex items-center gap-4 text-left no-select"
                onClick={() => {
                  play('click');
                  navigate('/profile');
                }}
              >
                <Avatar avatarId={profile.avatarId} size={68} level={level} animated />
                <div>
                  <div className="font-display text-xl font-bold text-ink">{profile.username}</div>
                  <div className="mt-1 text-xs font-semibold text-ink-faint">
                    {profile.xp - floor} / {ceiling - floor} XP to level {level + 1}
                  </div>
                  <ProgressBar
                    className="mt-2 w-40"
                    value={profile.xp - floor}
                    max={Math.max(1, ceiling - floor)}
                    color="var(--color-violet)"
                  />
                </div>
              </button>

              <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile icon="swords" label="Matches" value={profile.totalMatches} tone="violet" />
                <StatTile icon="crown" label="Wins" value={profile.wins} tone="sun" />
                <StatTile icon="target" label="Win rate" value={`${winRate}%`} tone="mint" />
                <StatTile icon="star" label="Best score" value={profile.bestScore} tone="coral" />
              </div>
            </div>
          </Card>
        </section>

        {/* ---------------------------------------------------- ACHIEVEMENTS */}
        <section>
          <SectionTitle
            icon="medal"
            title={unlocked.length ? 'Recent achievements' : 'Achievements to chase'}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(unlocked.length ? unlocked : nextUp).map((achievement) => {
              const earned = profile.achievements.includes(achievement.id);
              return (
                <motion.div
                  key={achievement.id}
                  whileHover={{ y: -3 }}
                  className="rounded-[22px] border-2 border-white bg-white p-4 text-center shadow-soft"
                >
                  <div
                    className={
                      'mx-auto grid h-12 w-12 place-items-center rounded-2xl ' +
                      (earned
                        ? achievement.tier === 'gold'
                          ? 'bg-sun text-white'
                          : achievement.tier === 'silver'
                            ? 'bg-sky text-white'
                            : 'bg-violet text-white'
                        : 'bg-mist text-ink-faint')
                    }
                  >
                    <Icon name={achievement.icon} size={22} />
                  </div>
                  <div className="mt-2 font-display text-sm font-bold text-ink">
                    {achievement.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-ink-faint">
                    {achievement.description}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------------ MINI-GAMES */}
        <section>
          <SectionTitle
            icon="sparkles"
            title="Mini-games in rotation"
            action={
              <span className="text-xs font-bold text-ink-faint">
                {MINI_GAME_LIST.length} live · more in training
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {MINI_GAME_LIST.map((game) => {
              const accent = accentOf(game.accent);
              return (
                <TapCard
                  key={game.id}
                  onClick={() => {
                    play('click');
                    navigate('/play');
                  }}
                  className="p-4"
                >
                  <div
                    className="grid h-11 w-11 place-items-center rounded-2xl"
                    style={{ background: accent.soft, color: accent.hex }}
                  >
                    <Icon name={game.icon} size={22} />
                  </div>
                  <div className="mt-3 font-display text-[15px] font-bold leading-tight text-ink">
                    {game.title}
                  </div>
                  <div className="mt-1 text-[11px] font-medium leading-snug text-ink-faint">
                    {game.tagline}
                  </div>
                  <div
                    className="mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: accent.soft, color: accent.deep }}
                  >
                    {game.category}
                  </div>
                </TapCard>
              );
            })}
          </div>
        </section>

        <footer className="pb-2 pt-4 text-center text-xs font-semibold text-ink-faint">
          BRAIN BATTLE · Think Fast. Play Smart. Win Together.
        </footer>
      </PageShell>
    </>
  );
}

function LeaderRow({ entry, highlight }: { entry: LeaderboardEntry; highlight: boolean }) {
  const medals = ['bg-sun text-ink', 'bg-sky-200 text-sky-deep', 'bg-coral-200 text-coral-deep'];
  return (
    <div
      className={
        'flex items-center gap-3 rounded-2xl p-2.5 ' +
        (highlight ? 'bg-violet-soft ring-2 ring-violet/30' : 'bg-mist')
      }
    >
      <div
        className={
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold ' +
          (medals[entry.rank - 1] ?? 'bg-white text-ink-soft')
        }
      >
        {entry.rank}
      </div>
      <Avatar avatarId={entry.avatarId} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-bold text-ink">{entry.username}</div>
        <div className="text-[11px] font-semibold text-ink-faint">Level {entry.level}</div>
      </div>
      <div className="font-display text-lg font-bold text-violet">
        {entry.score.toLocaleString()}
      </div>
    </div>
  );
}
