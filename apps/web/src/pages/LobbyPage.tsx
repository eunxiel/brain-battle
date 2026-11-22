import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ROOM_CODE_LENGTH } from '@brain-battle/shared';
import { Avatar } from '../design/Avatar';
import { Button } from '../design/Button';
import { Card, Pill } from '../design/Card';
import { Icon } from '../design/Icon';
import { Modal, PageShell } from '../design/Shell';
import { TopBar } from '../components/TopBar';
import { play } from '../audio/sfx';
import { useGameStore } from '../store/game';
import { useSessionStore } from '../store/session';

export function LobbyPage() {
  const navigate = useNavigate();
  const mode = useGameStore((s) => s.mode);
  const queue = useGameStore((s) => s.queue);
  const matchFoundWith = useGameStore((s) => s.matchFoundWith);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const joinQueue = useGameStore((s) => s.joinQueue);
  const leaveQueue = useGameStore((s) => s.leaveQueue);
  const profile = useSessionStore((s) => s.profile);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | 'queue' | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVersus = mode === 'versus';
  const accent = isVersus ? 'coral' : 'mint';

  useEffect(() => {
    if (joinOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [joinOpen]);

  // Leaving the page should never leave a ghost ticket in the queue.
  useEffect(
    () => () => {
      if (useGameStore.getState().queue.searching) void useGameStore.getState().leaveQueue();
    },
    [],
  );

  const onCreate = async (): Promise<void> => {
    play('pop');
    setBusy('create');
    const created = await createRoom(mode);
    setBusy(null);
    if (created) navigate('/room');
  };

  const onJoin = async (): Promise<void> => {
    if (code.trim().length < ROOM_CODE_LENGTH) return;
    play('click');
    setBusy('join');
    const joined = await joinRoom(code);
    setBusy(null);
    if (joined) {
      setJoinOpen(false);
      navigate('/room');
    }
  };

  const onQuickMatch = async (): Promise<void> => {
    play('pop');
    setBusy('queue');
    await joinQueue(mode);
    setBusy(null);
  };

  return (
    <>
      <TopBar />
      <PageShell width="max-w-3xl" className="space-y-5">
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="ghost" icon="back" size="sm" onClick={() => navigate('/play')}>
            Modes
          </Button>
          <Pill tone={accent}>
            <Icon name={isVersus ? 'swords' : 'handshake'} size={13} />
            {isVersus ? 'VERSUS' : 'CO-OP'} MODE
          </Pill>
        </div>

        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Find your partner</h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">
            Invite a friend with a room code, or get matched with a player who is online right now.
          </p>
        </div>

        {/* Random matchmaking */}
        <Card padding="lg" className="relative overflow-hidden">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-soft" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet text-white shadow-soft">
                <Icon name="search" size={26} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-ink">Quick match</h2>
                <p className="mt-1 max-w-sm text-sm text-ink-soft">
                  We pair you with the next player searching for {isVersus ? 'Versus' : 'Co-op'}.
                </p>
              </div>
            </div>
            <Button size="lg" icon="bolt" loading={busy === 'queue'} onClick={() => void onQuickMatch()}>
              Find match
            </Button>
          </div>
        </Card>

        {/* Friend room */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Card padding="lg" className="flex flex-col">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sun-soft text-sun-deep">
              <Icon name="plus" size={24} />
            </div>
            <h2 className="mt-3 font-display text-xl font-bold text-ink">Create room</h2>
            <p className="mt-1 flex-1 text-sm text-ink-soft">
              Get a private {ROOM_CODE_LENGTH}-character code and send it to a friend.
            </p>
            <Button
              className="mt-4"
              variant="sun"
              icon="link"
              fullWidth
              loading={busy === 'create'}
              onClick={() => void onCreate()}
            >
              Create a room
            </Button>
          </Card>

          <Card padding="lg" className="flex flex-col">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-soft text-sky-deep">
              <Icon name="users" size={24} />
            </div>
            <h2 className="mt-3 font-display text-xl font-bold text-ink">Join room</h2>
            <p className="mt-1 flex-1 text-sm text-ink-soft">
              Got a code from a friend? Drop it in and jump straight into their lobby.
            </p>
            <Button
              className="mt-4"
              variant="sky"
              icon="forward"
              fullWidth
              onClick={() => {
                play('click');
                setJoinOpen(true);
              }}
            >
              Enter a code
            </Button>
          </Card>
        </div>

        <p className="pt-1 text-center text-xs font-semibold text-ink-faint">
          Both players can be on different devices — phone, tablet or desktop.
        </p>
      </PageShell>

      {/* Join by code */}
      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join a room"
        subtitle="Ask your friend for their room code."
        icon="link"
      >
        <input
          ref={inputRef}
          value={code}
          onChange={(event) =>
            setCode(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, ROOM_CODE_LENGTH),
            )
          }
          onKeyDown={(event) => event.key === 'Enter' && void onJoin()}
          placeholder="ABC12"
          inputMode="text"
          autoCapitalize="characters"
          className="w-full rounded-2xl border-2 border-mist-deep bg-mist px-4 py-4 text-center font-display text-3xl font-bold uppercase tracking-[0.35em] text-ink outline-none transition-colors focus:border-violet"
        />
        <Button
          className="mt-4"
          size="lg"
          fullWidth
          icon="check"
          disabled={code.length < ROOM_CODE_LENGTH}
          loading={busy === 'join'}
          onClick={() => void onJoin()}
        >
          Join room
        </Button>
      </Modal>

      {/* Matchmaking overlay */}
      <AnimatePresence>
        {(queue.searching || matchFoundWith) && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-[32px] border-2 border-white bg-white p-7 text-center shadow-pop"
            >
              {matchFoundWith ? (
                <>
                  <motion.div
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                    className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-mint text-white"
                  >
                    <Icon name="check" size={32} />
                  </motion.div>
                  <h2 className="mt-4 font-display text-2xl font-bold text-ink">Opponent found!</h2>
                  <div className="mt-5 flex items-center justify-center gap-5">
                    <div className="flex flex-col items-center gap-1.5">
                      <Avatar avatarId={profile?.avatarId ?? 'nova'} size={62} ring="var(--color-violet)" />
                      <span className="font-display text-sm font-bold text-ink">You</span>
                    </div>
                    <span className="font-display text-xl font-bold text-ink-faint">VS</span>
                    <div className="flex flex-col items-center gap-1.5">
                      <Avatar avatarId={matchFoundWith.avatarId} size={62} ring="var(--color-coral)" />
                      <span className="font-display text-sm font-bold text-ink">
                        {matchFoundWith.username}
                      </span>
                    </div>
                  </div>
                  <p className="mt-5 text-sm font-semibold text-ink-soft">Starting the match…</p>
                </>
              ) : (
                <>
                  <div className="relative mx-auto grid h-24 w-24 place-items-center">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="absolute h-20 w-20 rounded-full border-2 border-violet/40"
                        animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                        transition={{ duration: 2.1, repeat: Infinity, delay: i * 0.7 }}
                      />
                    ))}
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-violet text-white">
                      <Icon name="search" size={28} className="animate-pulse" />
                    </div>
                  </div>
                  <h2 className="mt-5 font-display text-2xl font-bold text-ink">
                    Searching for a player…
                  </h2>
                  <p className="mt-2 text-sm text-ink-soft">
                    {Math.floor(queue.waitingMs / 1000)}s · {queue.playersSearching} in the{' '}
                    {queue.mode === 'coop' ? 'Co-op' : 'Versus'} queue
                  </p>
                  <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-xs font-semibold text-ink-soft">
                    Tip: open BRAIN BATTLE on a second device to match instantly.
                  </p>
                  <Button
                    className="mt-5"
                    variant="outline"
                    fullWidth
                    icon="close"
                    onClick={() => {
                      play('click');
                      void leaveQueue();
                    }}
                  >
                    Cancel search
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
