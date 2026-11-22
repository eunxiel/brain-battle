import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TOTAL_ROUNDS, getMiniGame } from '@brain-battle/shared';
import { Button } from '../design/Button';
import { Icon } from '../design/Icon';
import { Modal } from '../design/Shell';
import { accentOf } from '../design/tokens';
import { ArenaHud, PlayerStrip } from '../components/arena/ArenaHud';
import { MatchCountdown, RoundIntro, RoundResult } from '../components/arena/RoundOverlays';
import { MINI_GAME_RENDERERS } from '../minigames';
import { useCountdown, useElapsed } from '../hooks/useCountdown';
import { useGameStore } from '../store/game';
import { useSessionStore } from '../store/session';
import { play } from '../audio/sfx';

export function ArenaPage() {
  const navigate = useNavigate();
  const myId = useSessionStore((s) => s.profile?.id ?? '');

  const phase = useGameStore((s) => s.phase);
  const matchId = useGameStore((s) => s.matchId);
  const matchMode = useGameStore((s) => s.matchMode);
  const solo = useGameStore((s) => s.solo);
  const roster = useGameStore((s) => s.roster);
  const snapshot = useGameStore((s) => s.snapshot);
  const meta = useGameStore((s) => s.meta);
  const round = useGameStore((s) => s.round);
  const roundResult = useGameStore((s) => s.roundResult);
  const answered = useGameStore((s) => s.answered);
  const opponentAnswered = useGameStore((s) => s.opponentAnswered);
  const startsAt = useGameStore((s) => s.startsAt);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const leaveMatch = useGameStore((s) => s.leaveMatch);
  const startSolo = useGameStore((s) => s.startSolo);

  const [paused, setPaused] = useState(false);

  const me = roster.find((p) => p.id === myId) ?? roster[0] ?? null;
  const opponent = roster.find((p) => p.id !== myId) ?? null;
  const myState = snapshot?.players.find((p) => p.playerId === myId);
  const theirState = snapshot?.players.find((p) => p.playerId !== myId);

  const countdownRemaining = useCountdown(phase === 'countdown' ? startsAt : null);
  const introRemaining = useCountdown(phase === 'intro' ? (meta?.startsAt ?? null) : null);
  const roundRemaining = useCountdown(phase === 'playing' ? (round?.deadline ?? null) : null);
  const elapsed = useElapsed(phase === 'playing' ? (round?.startsAt ?? null) : null);

  // No live match? Send the player somewhere useful.
  useEffect(() => {
    if (!matchId) navigate('/', { replace: true });
  }, [matchId, navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPaused((value) => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const game = meta ? getMiniGame(meta.gameId) : null;
  const accent = accentOf(meta?.accent);
  const Renderer = meta ? MINI_GAME_RENDERERS[meta.gameId] : null;
  const instruction = useMemo(() => {
    if (!meta) return '';
    return matchMode === 'coop' && meta.coopInstruction ? meta.coopInstruction : meta.instruction;
  }, [meta, matchMode]);

  if (!matchId || !me) return null;

  const onLeave = async (): Promise<void> => {
    play('click');
    await leaveMatch();
    navigate('/');
  };

  const onRestartSolo = async (): Promise<void> => {
    play('click');
    await leaveMatch();
    const started = await startSolo();
    setPaused(false);
    if (!started) navigate('/');
  };

  return (
    <div className="flex h-dvh flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-2 sm:gap-3">
        <ArenaHud
          round={snapshot?.roundIndex ?? 0}
          totalRounds={snapshot?.totalRounds ?? TOTAL_ROUNDS}
          remaining={phase === 'playing' ? roundRemaining : (round?.durationMs ?? meta?.durationMs ?? 1)}
          duration={round?.durationMs ?? meta?.durationMs ?? 1}
          onPause={() => {
            play('click');
            setPaused(true);
          }}
          mode={matchMode}
        />

        {/* Scoreboard */}
        <div className={solo ? 'mx-auto w-full max-w-sm' : 'grid grid-cols-2 gap-2.5'}>
          <PlayerStrip
            player={me}
            state={myState}
            isYou
            answered={answered}
            mode={matchMode}
            teamScore={snapshot?.teamScore ?? null}
          />
          {opponent && (
            <PlayerStrip
              player={opponent}
              state={theirState}
              isYou={false}
              answered={opponentAnswered}
              mode={matchMode}
              teamScore={snapshot?.teamScore ?? null}
            />
          )}
        </div>

        {matchMode === 'coop' && snapshot?.teamScore !== null && snapshot?.teamScore !== undefined && (
          <div className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-mint px-4 py-1.5 text-white shadow-soft">
            <Icon name="handshake" size={15} />
            <span className="font-display text-sm font-bold">
              Team score {snapshot.teamScore.toLocaleString()}
            </span>
          </div>
        )}

        {/* Stage — min-h-0 lets it shrink instead of pushing the HUD off screen */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <AnimatePresence mode="wait">
            {phase === 'countdown' && (
              <motion.div key="countdown" className="flex flex-1 flex-col" exit={{ opacity: 0 }}>
                <MatchCountdown remaining={countdownRemaining} />
              </motion.div>
            )}

            {phase === 'intro' && meta && (
              <RoundIntro key={`intro-${meta.roundIndex}`} meta={meta} mode={matchMode} remaining={introRemaining} />
            )}

            {(phase === 'playing' || phase === 'result') && meta && Renderer && round && (
              <motion.div
                key={`play-${meta.roundIndex}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="relative flex min-h-0 flex-1 flex-col"
              >
                {/* Mini-game header. Hidden on very short screens (phone in
                    landscape): the same instruction was just shown in the intro,
                    so the playfield wins the space. */}
                <div className="mb-2 flex items-center gap-3 rounded-[22px] border-2 border-white bg-white px-4 py-2.5 shadow-soft sm:mb-3 short:hidden">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
                    style={{ background: accent.hex }}
                  >
                    <Icon name={meta.icon} size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold leading-tight text-ink">
                      {game?.title}
                    </div>
                    <p className="truncate text-xs font-medium text-ink-soft sm:whitespace-normal">
                      {instruction}
                    </p>
                  </div>
                </div>

                {/* Interactive area */}
                <div
                  className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto overflow-x-hidden rounded-[28px] border-2 border-white p-3 shadow-card sm:p-6"
                  style={{ background: `linear-gradient(180deg, #fff 0%, ${accent.soft} 160%)` }}
                >
                  <Renderer
                    key={`${meta.roundIndex}-${meta.gameId}`}
                    view={round.payload as never}
                    submit={(answer, elapsedOverride) =>
                      submitAnswer(answer, elapsedOverride ?? elapsed)
                    }
                    elapsed={elapsed}
                    remaining={roundRemaining}
                    durationMs={round.durationMs}
                    mode={matchMode}
                    locked={answered || phase === 'result'}
                    accent={accent}
                  />

                  <AnimatePresence>
                    {answered && phase === 'playing' && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ink/85 px-4 py-2 text-xs font-bold text-white backdrop-blur"
                      >
                        Answer locked — waiting for the round to close…
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {phase === 'result' && roundResult && (
                      <RoundResult
                        key={`result-${roundResult.roundIndex}`}
                        result={roundResult}
                        myId={myId}
                        mode={matchMode}
                        opponentName={opponent?.username ?? null}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pause */}
      <Modal
        open={paused}
        onClose={() => setPaused(false)}
        title="Paused"
        subtitle={`Round ${(snapshot?.roundIndex ?? 0) + 1} of ${snapshot?.totalRounds ?? TOTAL_ROUNDS}`}
        icon="pause"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-mist p-3 text-center">
            <PauseStat label="Score" value={(myState?.score ?? 0).toLocaleString()} />
            <PauseStat label="Correct" value={String(myState?.correct ?? 0)} />
            <PauseStat label="Lives" value={String(myState?.lives ?? 0)} />
          </div>

          {!solo && (
            <p className="rounded-2xl bg-sun-soft px-4 py-3 text-xs font-bold text-sun-deep">
              This is a live match — the timer keeps running for your opponent while this menu is
              open.
            </p>
          )}

          <Button fullWidth size="lg" icon="play" onClick={() => setPaused(false)}>
            Resume
          </Button>
          {solo && (
            <Button fullWidth variant="outline" icon="refresh" onClick={() => void onRestartSolo()}>
              Restart daily run
            </Button>
          )}
          <Button fullWidth variant="danger" icon="logout" onClick={() => void onLeave()}>
            {solo ? 'Quit run' : 'Forfeit & leave match'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PauseStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-bold text-ink">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  );
}
