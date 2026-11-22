import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ACHIEVEMENTS,
  AVATARS,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  levelForXp,
  xpForLevel,
  type MatchHistoryEntry,
} from '@brain-battle/shared';
import { Avatar } from '../design/Avatar';
import { Button } from '../design/Button';
import { Card, Pill, SectionTitle } from '../design/Card';
import { EmptyState, ProgressBar } from '../design/Feedback';
import { Icon } from '../design/Icon';
import { PageShell } from '../design/Shell';
import { StatTile } from '../design/Stats';
import { TopBar } from '../components/TopBar';
import { play } from '../audio/sfx';
import { useSessionStore } from '../store/session';
import { toast } from '../store/ui';

export function ProfilePage() {
  const navigate = useNavigate();
  const profile = useSessionStore((s) => s.profile);
  const history = useSessionStore((s) => s.history);
  const saveProfile = useSessionStore((s) => s.saveProfile);
  const refreshBundle = useSessionStore((s) => s.refreshBundle);

  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarId, setAvatarId] = useState(profile?.avatarId ?? 'nova');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refreshBundle();
  }, [refreshBundle]);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setAvatarId(profile.avatarId);
  }, [profile]);

  if (!profile) return null;

  const level = levelForXp(profile.xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const winRate = profile.totalMatches ? Math.round((profile.wins / profile.totalMatches) * 100) : 0;
  const dirty = username !== profile.username || avatarId !== profile.avatarId;
  const nameValid =
    username.trim().length >= MIN_USERNAME_LENGTH && username.trim().length <= MAX_USERNAME_LENGTH;

  const onSave = async (): Promise<void> => {
    if (!nameValid) return;
    play('click');
    setSaving(true);
    const saved = await saveProfile({ username: username.trim(), avatarId });
    setSaving(false);
    toast(saved ? 'success' : 'error', saved ? 'Profile updated!' : 'Could not save your profile.');
  };

  return (
    <>
      <TopBar />
      <PageShell className="space-y-5">
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" icon="back" size="sm" onClick={() => navigate('/')}>
            Home
          </Button>
          <Pill tone="violet">
            <Icon name="user" size={13} />
            ID {profile.id.slice(0, 8).toUpperCase()}
          </Pill>
        </div>

        {/* Identity */}
        <Card padding="lg">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Avatar avatarId={avatarId} size={100} level={level} animated />

            <div className="w-full flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Username
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={username}
                  maxLength={MAX_USERNAME_LENGTH}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border-2 border-mist-deep bg-mist px-4 py-3 font-display text-lg font-bold text-ink outline-none transition-colors focus:border-violet"
                />
                <Button
                  icon="check"
                  disabled={!dirty || !nameValid}
                  loading={saving}
                  onClick={() => void onSave()}
                >
                  Save
                </Button>
              </div>
              {!nameValid && (
                <p className="mt-1.5 text-xs font-bold text-coral">
                  Between {MIN_USERNAME_LENGTH} and {MAX_USERNAME_LENGTH} characters, please.
                </p>
              )}

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-bold text-ink-faint">
                  <span>LEVEL {level}</span>
                  <span>
                    {profile.xp - floor} / {ceiling - floor} XP
                  </span>
                </div>
                <ProgressBar
                  className="mt-1.5"
                  value={profile.xp - floor}
                  max={Math.max(1, ceiling - floor)}
                  height={12}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Avatar picker */}
        <section>
          <SectionTitle icon="sparkles" title="Choose your avatar" />
          <Card padding="md">
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12">
              {AVATARS.map((option) => {
                const selected = option.id === avatarId;
                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      play('pop');
                      setAvatarId(option.id);
                    }}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-colors no-select',
                      selected ? 'bg-violet-soft' : 'hover:bg-mist',
                    )}
                  >
                    <Avatar
                      avatarId={option.id}
                      size={48}
                      ring={selected ? 'var(--color-violet)' : undefined}
                    />
                    <span className="text-[10px] font-bold text-ink-faint">{option.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Stats */}
        <section>
          <SectionTitle icon="target" title="Statistics" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile icon="swords" label="Matches" value={profile.totalMatches} tone="violet" />
            <StatTile icon="crown" label="Wins" value={profile.wins} tone="sun" />
            <StatTile icon="target" label="Win rate" value={`${winRate}%`} tone="mint" />
            <StatTile icon="star" label="Best score" value={profile.bestScore} tone="coral" />
            <StatTile icon="check" label="Correct" value={profile.totalCorrect} tone="mint" />
            <StatTile
              icon="clock"
              label="Avg time"
              value={profile.avgResponseMs ? `${(profile.avgResponseMs / 1000).toFixed(2)}s` : '—'}
              tone="sky"
            />
          </div>
        </section>

        {/* Achievements */}
        <section>
          <SectionTitle
            icon="medal"
            title="Achievements"
            action={
              <span className="text-xs font-bold text-ink-faint">
                {profile.achievements.length}/{ACHIEVEMENTS.length} unlocked
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ACHIEVEMENTS.map((achievement) => {
              const earned = profile.achievements.includes(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={clsx(
                    'rounded-[22px] border-2 p-4 text-center shadow-soft transition-colors',
                    earned ? 'border-white bg-white' : 'border-mist-deep/50 bg-white/55',
                  )}
                >
                  <div
                    className={clsx(
                      'mx-auto grid h-12 w-12 place-items-center rounded-2xl',
                      !earned
                        ? 'bg-mist text-ink-faint'
                        : achievement.tier === 'gold'
                          ? 'bg-sun text-white'
                          : achievement.tier === 'silver'
                            ? 'bg-sky text-white'
                            : 'bg-violet text-white',
                    )}
                  >
                    <Icon name={earned ? achievement.icon : 'medal'} size={22} />
                  </div>
                  <div
                    className={clsx(
                      'mt-2 font-display text-sm font-bold',
                      earned ? 'text-ink' : 'text-ink-faint',
                    )}
                  >
                    {achievement.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-ink-faint">
                    {achievement.description}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* History */}
        <section className="pb-4">
          <SectionTitle icon="clock" title="Match history" />
          <Card padding="sm">
            {history.length === 0 ? (
              <EmptyState
                icon="swords"
                title="No matches yet"
                description="Your last 20 matches will show up here."
                action={
                  <Button className="mt-2" icon="play" onClick={() => navigate('/play')}>
                    Play your first match
                  </Button>
                }
              />
            ) : (
              <div className="divide-y-2 divide-mist">
                {history.map((entry) => (
                  <HistoryRow key={`${entry.matchId}-${entry.playedAt}`} entry={entry} />
                ))}
              </div>
            )}
          </Card>
        </section>
      </PageShell>
    </>
  );
}

const OUTCOME_STYLES: Record<
  MatchHistoryEntry['outcome'],
  { label: string; className: string; icon: string }
> = {
  win: { label: 'Win', className: 'bg-mint-soft text-mint-deep', icon: 'crown' },
  loss: { label: 'Loss', className: 'bg-coral-soft text-coral-deep', icon: 'close' },
  draw: { label: 'Draw', className: 'bg-sun-soft text-sun-deep', icon: 'swords' },
  'team-win': { label: 'Team win', className: 'bg-mint-soft text-mint-deep', icon: 'handshake' },
  'team-loss': { label: 'Team loss', className: 'bg-coral-soft text-coral-deep', icon: 'handshake' },
};

function HistoryRow({ entry }: { entry: MatchHistoryEntry }) {
  const style = OUTCOME_STYLES[entry.outcome];
  const when = new Date(entry.playedAt);
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar avatarId={entry.opponentAvatarId} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] font-bold text-ink">
          vs {entry.opponentName}
        </div>
        <div className="text-[11px] font-semibold text-ink-faint">
          {entry.mode === 'coop' ? 'Co-op' : 'Versus'} · {entry.correct} correct · {entry.wrong}{' '}
          missed · {when.toLocaleDateString()}
        </div>
      </div>
      <span
        className={clsx(
          'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
          style.className,
        )}
      >
        <Icon name={style.icon} size={12} />
        {style.label}
      </span>
      <div className="w-16 text-right font-display text-lg font-bold text-violet tabular-nums">
        {entry.score.toLocaleString()}
      </div>
    </div>
  );
}
