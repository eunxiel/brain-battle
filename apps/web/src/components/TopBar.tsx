import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { levelForXp, xpForLevel } from '@brain-battle/shared';
import { Avatar } from '../design/Avatar';
import { IconButton } from '../design/Button';
import { Icon } from '../design/Icon';
import { Logo } from '../design/Shell';
import { ProgressBar } from '../design/Feedback';
import { useSessionStore } from '../store/session';
import { useUiStore } from '../store/ui';
import { play } from '../audio/sfx';

export function TopBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const profile = useSessionStore((s) => s.profile);
  const status = useSessionStore((s) => s.status);
  const soundEnabled = useUiStore((s) => s.soundEnabled);
  const toggleSound = useUiStore((s) => s.toggleSound);

  const level = profile ? levelForXp(profile.xp) : 1;
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const progress = profile ? (profile.xp - floor) / Math.max(1, ceiling - floor) : 0;

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-4 sm:px-6">
      <button
        onClick={() => {
          play('click');
          navigate('/');
        }}
        className="no-select"
        aria-label="Go to home"
      >
        <Logo size={compact ? 'sm' : 'sm'} />
      </button>

      <div className="flex items-center gap-2">
        {status !== 'online' && (
          <span
            className={clsx(
              'hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:flex',
              status === 'offline' ? 'bg-coral-soft text-coral-deep' : 'bg-sun-soft text-sun-deep',
            )}
          >
            <Icon name={status === 'offline' ? 'offline' : 'spinner'} size={14} className={status !== 'offline' ? 'animate-spin' : ''} />
            {status === 'offline' ? 'Offline' : 'Connecting'}
          </span>
        )}

        <IconButton
          icon={soundEnabled ? 'sound' : 'muted'}
          label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          size={40}
          onClick={() => {
            toggleSound();
            play('click');
          }}
        />

        {profile && (
          <button
            onClick={() => {
              play('click');
              navigate('/profile');
            }}
            className="flex items-center gap-2.5 rounded-2xl bg-white/85 py-1.5 pl-1.5 pr-3 shadow-soft transition-transform hover:scale-[1.03] active:scale-95 no-select"
          >
            <Avatar avatarId={profile.avatarId} size={34} />
            <div className="hidden text-left leading-tight sm:block">
              <div className="font-display text-sm font-semibold text-ink">{profile.username}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  Lv {level}
                </span>
                <ProgressBar value={progress} height={4} className="w-14" />
              </div>
            </div>
          </button>
        )}
      </div>
    </header>
  );
}
