import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { STARTING_LIVES, TOTAL_ROUNDS, type GameMode } from '@brain-battle/shared';
import { Button } from '../design/Button';
import { Pill } from '../design/Card';
import { Icon, type IconName } from '../design/Icon';
import { PageShell } from '../design/Shell';
import { TopBar } from '../components/TopBar';
import { play } from '../audio/sfx';
import { useGameStore } from '../store/game';

interface ModeCardData {
  mode: GameMode;
  title: string;
  hook: string;
  description: string;
  icon: IconName;
  bullets: { icon: IconName; text: string }[];
  className: string;
  buttonVariant: 'coral' | 'mint';
}

const MODES: ModeCardData[] = [
  {
    mode: 'versus',
    title: 'VERSUS',
    hook: "Challenge your friend's brain.",
    description:
      'Same puzzle, same difficulty, same second. Faster and sharper answers score more — last brain standing takes it.',
    icon: 'swords',
    bullets: [
      { icon: 'bolt', text: 'Speed bonus on every correct answer' },
      { icon: 'heart', text: `${STARTING_LIVES} lives each — miss and you lose one` },
      { icon: 'crown', text: 'Highest score after 12 rounds wins' },
    ],
    className: 'bg-coral text-white',
    buttonVariant: 'coral',
  },
  {
    mode: 'coop',
    title: 'CO-OP',
    hook: 'Work together. Think together.',
    description:
      'Each of you only sees half of the puzzle. Talk, share, and solve it as one brain — shared lives, shared glory.',
    icon: 'handshake',
    bullets: [
      { icon: 'users', text: 'Split information — you must communicate' },
      { icon: 'heart', text: `${STARTING_LIVES} shared lives for the team` },
      { icon: 'sparkles', text: 'Sync bonus when you both nail it' },
    ],
    className: 'bg-mint text-white',
    buttonVariant: 'mint',
  },
];

export function ModeSelectPage() {
  const navigate = useNavigate();
  const setMode = useGameStore((s) => s.setMode);

  const choose = (mode: GameMode): void => {
    play('pop');
    setMode(mode);
    navigate('/lobby');
  };

  return (
    <>
      <TopBar />
      <PageShell className="space-y-6">
        <div className="flex items-center gap-3 pt-2">
          <Button variant="ghost" icon="back" size="sm" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>

        <div className="text-center">
          <Pill tone="violet">
            <Icon name="play" size={13} />
            Choose your battle
          </Pill>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
            How do you want to play?
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">
            {TOTAL_ROUNDS} rounds of brain-bending mini-games, either way.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {MODES.map((data, index) => (
            <motion.button
              key={data.mode}
              type="button"
              onClick={() => choose(data.mode)}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 220, damping: 22 }}
              whileHover={{ y: -8, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className={`group relative overflow-hidden rounded-[32px] border-2 border-white p-6 text-left shadow-card no-select sm:p-7 ${data.className}`}
            >
              <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/12 transition-transform duration-500 group-hover:scale-125" />
              <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-white/10" />

              <div className="relative">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="grid h-14 w-14 place-items-center rounded-[20px] bg-white/20 backdrop-blur-sm"
                    animate={{ rotate: [0, -6, 6, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Icon name={data.icon} size={28} />
                  </motion.div>
                  <div>
                    <div className="font-display text-3xl font-bold leading-none">{data.title}</div>
                    <div className="mt-1.5 text-sm font-semibold text-white/85">{data.hook}</div>
                  </div>
                </div>

                <p className="mt-5 text-[15px] font-medium leading-relaxed text-white/85">
                  {data.description}
                </p>

                <ul className="mt-5 space-y-2">
                  {data.bullets.map((bullet) => (
                    <li key={bullet.text} className="flex items-center gap-2.5 text-sm font-semibold">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/20">
                        <Icon name={bullet.icon} size={14} />
                      </span>
                      {bullet.text}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex items-center gap-2 font-display text-lg font-bold">
                  <span className="rounded-2xl bg-white px-5 py-2.5 text-ink shadow-soft transition-transform group-hover:translate-x-1">
                    Select {data.title}
                  </span>
                  <Icon name="forward" size={22} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </PageShell>
    </>
  );
}
