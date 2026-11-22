import clsx from 'clsx';
import { getAvatar, type AvatarFace } from '@brain-battle/shared';

/** Decorations layered on top of the shared eyes + smile base. */
function FaceDecor({ face, accent }: { face: AvatarFace; accent: string }) {
  switch (face) {
    case 'spark':
      return (
        <path
          d="M50 6l4.2 9.4L64 19.6l-9.8 4.2L50 33l-4.2-9.2L36 19.6l9.8-4.2z"
          fill={accent}
          opacity="0.95"
        />
      );
    case 'bolt':
      return <path d="M54 12l-14 20h9l-5 16 16-22h-9z" fill={accent} />;
    case 'owl':
      return (
        <>
          <path d="M22 26l10-14 7 13z" fill={accent} opacity="0.85" />
          <path d="M78 26L68 12l-7 13z" fill={accent} opacity="0.85" />
          <path d="M50 58l-6 7h12z" fill={accent} />
        </>
      );
    case 'cat':
      return (
        <>
          <path d="M24 30l2-18 15 11z" fill={accent} opacity="0.9" />
          <path d="M76 30l-2-18-15 11z" fill={accent} opacity="0.9" />
          <g stroke={accent} strokeWidth="2.6" strokeLinecap="round" opacity="0.8">
            <path d="M16 50h10M16 58h10M84 50H74M84 58H74" />
          </g>
        </>
      );
    case 'robot':
      return (
        <>
          <rect x="47" y="6" width="6" height="12" rx="3" fill={accent} />
          <circle cx="50" cy="6" r="5" fill={accent} />
          <rect x="10" y="42" width="7" height="18" rx="3.5" fill={accent} opacity="0.85" />
          <rect x="83" y="42" width="7" height="18" rx="3.5" fill={accent} opacity="0.85" />
        </>
      );
    case 'alien':
      return (
        <>
          <g stroke={accent} strokeWidth="3" strokeLinecap="round">
            <path d="M34 20l-6-12M66 20l6-12" />
          </g>
          <circle cx="28" cy="7" r="4.5" fill={accent} />
          <circle cx="72" cy="7" r="4.5" fill={accent} />
        </>
      );
    case 'bear':
      return (
        <>
          <circle cx="24" cy="22" r="12" fill={accent} opacity="0.9" />
          <circle cx="76" cy="22" r="12" fill={accent} opacity="0.9" />
          <ellipse cx="50" cy="62" rx="16" ry="11" fill="white" opacity="0.35" />
        </>
      );
    case 'ghost':
      return (
        <path
          d="M18 72c6 0 6 8 12 8s6-8 12-8 6 8 12 8 6-8 12-8 6 8 12 8v14H18z"
          fill={accent}
          opacity="0.5"
        />
      );
    default:
      return null;
  }
}

export interface AvatarProps {
  avatarId: string;
  size?: number;
  className?: string;
  /** Coloured ring, typically the player's slot colour. */
  ring?: string;
  level?: number;
  /** Renders a connection dot when provided. */
  online?: boolean;
  /** Subtle idle breathing; disable in dense lists. */
  animated?: boolean;
}

export function Avatar({
  avatarId,
  size = 64,
  className,
  ring,
  level,
  online,
  animated = false,
}: AvatarProps) {
  const avatar = getAvatar(avatarId);
  const gradientId = `grad-${avatar.id}`;

  return (
    <div
      className={clsx('relative shrink-0 no-select', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-[28%]"
        style={{
          boxShadow: ring
            ? `0 0 0 3px white, 0 0 0 6px ${ring}, 0 10px 22px -10px rgba(74,48,150,.5)`
            : '0 10px 22px -12px rgba(74,48,150,.55)',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className={clsx('h-full w-full', animated && 'animate-[float_6s_ease-in-out_infinite]')}
          role="img"
          aria-label={`${avatar.name} avatar`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={avatar.from} />
              <stop offset="100%" stopColor={avatar.to} />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#${gradientId})`} />
          <circle cx="82" cy="18" r="26" fill="white" opacity="0.1" />
          <FaceDecor face={avatar.face} accent={avatar.accent} />
          <g>
            <ellipse cx="36" cy="46" rx="9" ry="10.5" fill="white" />
            <ellipse cx="64" cy="46" rx="9" ry="10.5" fill="white" />
            <circle cx="37.5" cy="47.5" r="4.6" fill="#241B4A" />
            <circle cx="65.5" cy="47.5" r="4.6" fill="#241B4A" />
            <circle cx="39.5" cy="45" r="1.6" fill="white" />
            <circle cx="67.5" cy="45" r="1.6" fill="white" />
          </g>
          <path
            d="M39 66c3.6 4.6 18.4 4.6 22 0"
            stroke="#241B4A"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
        </svg>
      </div>

      {typeof level === 'number' && (
        <span
          className="absolute -bottom-1.5 -right-1.5 grid place-items-center rounded-full border-[3px] border-white bg-ink font-display text-[11px] font-bold text-white shadow-soft"
          style={{ minWidth: Math.max(22, size * 0.34), height: Math.max(22, size * 0.34) }}
        >
          {level}
        </span>
      )}

      {online !== undefined && (
        <span
          className={clsx(
            'absolute -right-0.5 -top-0.5 rounded-full border-[3px] border-white',
            online ? 'bg-mint' : 'bg-ink-faint',
          )}
          style={{ width: Math.max(14, size * 0.22), height: Math.max(14, size * 0.22) }}
          title={online ? 'Connected' : 'Disconnected'}
        />
      )}
    </div>
  );
}
