import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'coral' | 'mint' | 'sun' | 'sky' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, { base: string; ledge: string }> = {
  primary: { base: 'bg-violet text-white', ledge: 'var(--color-violet-deep)' },
  coral: { base: 'bg-coral text-white', ledge: 'var(--color-coral-deep)' },
  mint: { base: 'bg-mint text-white', ledge: 'var(--color-mint-deep)' },
  sun: { base: 'bg-sun text-ink', ledge: 'var(--color-sun-deep)' },
  sky: { base: 'bg-sky text-white', ledge: 'var(--color-sky-deep)' },
  danger: { base: 'bg-coral-deep text-white', ledge: '#a72a47' },
  ghost: { base: 'bg-white/70 text-ink-soft hover:bg-white', ledge: 'transparent' },
  outline: { base: 'bg-white text-ink border-2 border-mist-deep', ledge: 'var(--color-mist-deep)' },
};

const SIZES: Record<Size, string> = {
  sm: 'h-10 px-4 text-sm gap-1.5 rounded-2xl',
  md: 'h-12 px-5 text-[15px] gap-2 rounded-2xl',
  lg: 'h-14 px-7 text-lg gap-2.5 rounded-[20px]',
  xl: 'h-16 px-9 text-xl gap-3 rounded-[24px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

/**
 * The signature control of the product: a solid colour block resting on a
 * darker ledge that compresses when pressed.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    fullWidth = false,
    className,
    children,
    disabled,
    style,
    ...rest
  },
  ref,
) {
  const theme = VARIANTS[variant];
  const flat = variant === 'ghost';
  const iconSize = size === 'xl' ? 24 : size === 'lg' ? 22 : size === 'sm' ? 16 : 18;

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={{ '--ledge-color': theme.ledge, ...style } as CSSProperties}
      className={clsx(
        'relative inline-flex items-center justify-center font-display font-semibold no-select',
        'transition-[filter,transform] duration-150 will-change-transform',
        'hover:brightness-[1.06] active:brightness-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:brightness-100',
        !flat && 'ledge ledge-press disabled:translate-y-0',
        SIZES[size],
        theme.base,
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icon name="spinner" size={iconSize} className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
});

/** Compact circular control for toolbars and overlays. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 44,
  className,
  ...rest
}: Omit<ButtonProps, 'children' | 'size' | 'icon'> & {
  icon: IconName;
  label: string;
  size?: number;
}) {
  const theme = VARIANTS[variant];
  return (
    <button
      aria-label={label}
      title={label}
      style={{ width: size, height: size, '--ledge-color': theme.ledge } as CSSProperties}
      className={clsx(
        'inline-flex items-center justify-center rounded-2xl no-select',
        'transition-transform duration-150 hover:scale-105 active:scale-95',
        'disabled:opacity-50 disabled:hover:scale-100',
        variant === 'ghost'
          ? 'bg-white/80 text-ink-soft shadow-soft hover:text-ink'
          : clsx(theme.base, 'ledge-sm'),
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.46)} />
    </button>
  );
}
