import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { STARTING_LIVES, TOTAL_ROUNDS, type PublicPlayer } from '@brain-battle/shared';
import { Avatar } from '../design/Avatar';
import { Button } from '../design/Button';
import { Card, Pill } from '../design/Card';
import { Icon } from '../design/Icon';
import { PageShell } from '../design/Shell';
import { TopBar } from '../components/TopBar';
import { play } from '../audio/sfx';
import { useGameStore } from '../store/game';
import { useSessionStore } from '../store/session';
import { toast } from '../store/ui';

export function WaitingRoomPage() {
  const navigate = useNavigate();
  const room = useGameStore((s) => s.room);
  const setReady = useGameStore((s) => s.setReady);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const startMatch = useGameStore((s) => s.startMatch);
  const myId = useSessionStore((s) => s.profile?.id);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  if (!room) return null;

  const me = room.players.find((p) => p.id === myId);
  const opponent = room.players.find((p) => p.id !== myId) ?? null;
  const isHost = room.hostId === myId;
  const isVersus = room.mode === 'versus';
  const everyoneReady = room.players.length === 2 && room.players.every((p) => p.ready && p.connected);

  const copyCode = async (): Promise<void> => {
    play('click');
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast('warning', `Copy failed — the code is ${room.code}`);
    }
  };

  const onStart = async (): Promise<void> => {
    play('start');
    setStarting(true);
    await startMatch();
    setStarting(false);
  };

  const onLeave = async (): Promise<void> => {
    play('click');
    await leaveRoom();
    navigate('/lobby');
  };

  return (
    <>
      <TopBar />
      <PageShell width="max-w-3xl" className="space-y-5">
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" icon="back" size="sm" onClick={() => void onLeave()}>
            Leave room
          </Button>
          <Pill tone={isVersus ? 'coral' : 'mint'}>
            <Icon name={isVersus ? 'swords' : 'handshake'} size={13} />
            {isVersus ? 'VERSUS' : 'CO-OP'}
          </Pill>
        </div>

        {/* Room code */}
        <Card padding="lg" className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-faint">
            Room code
          </div>
          <button
            onClick={() => void copyCode()}
            className="group mx-auto mt-2 flex items-center gap-3 rounded-2xl px-3 py-1 no-select"
          >
            <span className="font-display text-5xl font-bold tracking-[0.18em] text-ink sm:text-6xl">
              {room.code}
            </span>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-soft text-violet transition-transform group-hover:scale-110 group-active:scale-95">
              <Icon name={copied ? 'check' : 'copy'} size={20} />
            </span>
          </button>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            {copied ? 'Copied to clipboard!' : 'Tap the code to copy and share it'}
          </p>
        </Card>

        {/* Players */}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <PlayerSlotCard player={me ?? null} isYou slotLabel="You" />
          <div className="hidden place-items-center sm:grid">
            <span className="font-display text-xl font-bold text-ink-faint">
              {isVersus ? 'VS' : '+'}
            </span>
          </div>
          <PlayerSlotCard player={opponent} isYou={false} slotLabel="Opponent" />
        </div>

        {/* Controls */}
        <Card padding="lg">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-mist p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                <Icon name="clock" size={16} className="text-violet" />
                {TOTAL_ROUNDS} rounds · {STARTING_LIVES} {isVersus ? 'lives each' : 'shared lives'}
              </div>
              <span className="text-xs font-bold text-ink-faint">
                {room.players.length}/2 players
              </span>
            </div>

            <Button
              size="lg"
              fullWidth
              variant={me?.ready ? 'outline' : 'mint'}
              icon={me?.ready ? 'close' : 'check'}
              onClick={() => {
                play('click');
                void setReady(!me?.ready);
              }}
            >
              {me?.ready ? "I'm not ready" : "I'm ready!"}
            </Button>

            {isHost ? (
              <Button
                size="xl"
                fullWidth
                icon="play"
                disabled={!everyoneReady}
                loading={starting}
                onClick={() => void onStart()}
              >
                {everyoneReady
                  ? 'START MATCH'
                  : room.players.length < 2
                    ? 'Waiting for a second player…'
                    : 'Waiting for both to be ready…'}
              </Button>
            ) : (
              <div className="rounded-2xl bg-violet-soft p-4 text-center">
                <p className="font-display font-semibold text-violet-deep">
                  {everyoneReady
                    ? 'Waiting for the host to start…'
                    : 'Hit ready — the host starts the match.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </PageShell>
    </>
  );
}

function PlayerSlotCard({
  player,
  isYou,
  slotLabel,
}: {
  player: PublicPlayer | null;
  isYou: boolean;
  slotLabel: string;
}) {
  const ring = isYou ? 'var(--color-violet)' : 'var(--color-coral)';

  if (!player) {
    return (
      <Card
        padding="lg"
        tone="none"
        className="border-dashed !border-mist-deep bg-white/60 text-center"
      >
        <div className="mx-auto grid h-[68px] w-[68px] place-items-center rounded-[28%] border-2 border-dashed border-mist-deep bg-mist">
          <Icon name="user" size={28} className="text-ink-faint" />
        </div>
        <div className="mt-3 font-display text-lg font-bold text-ink-faint">Waiting…</div>
        <p className="mt-1 text-xs font-semibold text-ink-faint">
          Share the room code to invite a player
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="relative overflow-hidden text-center">
      <AnimatePresence>
        {player.ready && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: -12 }}
            exit={{ scale: 0 }}
            className="absolute -right-6 top-4 rounded-xl bg-mint px-8 py-1 font-display text-xs font-bold uppercase tracking-widest text-white shadow-soft"
          >
            Ready
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto w-fit">
        <Avatar
          avatarId={player.avatarId}
          size={68}
          ring={ring}
          level={player.level}
          online={player.connected}
        />
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <span className="font-display text-lg font-bold text-ink">{player.username}</span>
        {player.isHost && <Icon name="crown" size={16} className="text-sun-deep" />}
      </div>
      <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {slotLabel} · {player.connected ? 'Connected' : 'Reconnecting…'}
      </div>
    </Card>
  );
}
