import {
  MATCH_COUNTDOWN_MS,
  ROUND_INTRO_MS,
  ROUND_RESULT_MS,
  RECONNECT_GRACE_MS,
  STARTING_LIVES,
  SYNC_BONUS,
  TOTAL_ROUNDS,
  buildRoundPlan,
  computeRoundScore,
  createRng,
  difficultyForRound,
  getMiniGame,
  type AnyMiniGame,
  type GameMode,
  type MatchPlayerState,
  type MatchResult,
  type MatchSnapshot,
  type MiniGameId,
  type PlayerRoundOutcome,
  type PlayerSlot,
  type PublicPlayer,
  type RoundMeta,
  type ServerToClientEvents,
} from '@brain-battle/shared';

export interface MatchParticipant {
  playerId: string;
  slot: PlayerSlot;
  username: string;
  avatarId: string;
  level: number;
}

/** Every server -> client event carries exactly one payload object. */
export type EmitEvent = <E extends keyof ServerToClientEvents>(
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0],
) => void;

export interface MatchHooks {
  emitToPlayer: <E extends keyof ServerToClientEvents>(
    playerId: string,
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0],
  ) => void;
  emitAll: EmitEvent;
  onFinished: (result: MatchResult, match: Match) => void;
}

interface PlayerRuntime extends MatchParticipant {
  score: number;
  lives: number;
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  responseTimes: number[];
  eliminated: boolean;
  connected: boolean;
  disconnectTimer: NodeJS.Timeout | null;
}

interface Submission {
  answer: unknown;
  clientElapsedMs: number;
  serverElapsedMs: number;
  correct: boolean;
  accuracy: number;
}

interface ActiveRound {
  index: number;
  gameId: MiniGameId;
  game: AnyMiniGame;
  payload: unknown;
  difficulty: number;
  durationMs: number;
  startsAt: number;
  deadline: number;
  open: boolean;
  closed: boolean;
  submissions: Map<string, Submission>;
}

export interface MatchOptions {
  matchId: string;
  mode: GameMode;
  roomCode: string;
  solo: boolean;
  participants: MatchParticipant[];
  plan?: MiniGameId[];
  hooks: MatchHooks;
}

/**
 * Server-authoritative match loop.
 * Clients never compute scores, never see solutions before a round closes and
 * never receive the half of a co-op puzzle that belongs to their partner.
 */
export class Match {
  readonly id: string;
  readonly mode: GameMode;
  readonly roomCode: string;
  readonly solo: boolean;
  readonly startedAt = new Date();

  private players = new Map<string, PlayerRuntime>();
  private plan: MiniGameId[];
  private hooks: MatchHooks;
  private roundIndex = -1;
  private round: ActiveRound | null = null;
  private teamLives: number;
  private teamScore = 0;
  private timers = new Set<NodeJS.Timeout>();
  private phase: MatchSnapshot['phase'] = 'countdown';
  private finished = false;

  constructor(options: MatchOptions) {
    this.id = options.matchId;
    this.mode = options.mode;
    this.roomCode = options.roomCode;
    this.solo = options.solo;
    this.hooks = options.hooks;
    this.teamLives = STARTING_LIVES;
    this.plan = options.plan ?? buildRoundPlan(createRng(options.matchId));
    for (const participant of options.participants) {
      this.players.set(participant.playerId, {
        ...participant,
        score: 0,
        lives: STARTING_LIVES,
        correct: 0,
        wrong: 0,
        streak: 0,
        bestStreak: 0,
        responseTimes: [],
        eliminated: false,
        connected: true,
        disconnectTimer: null,
      });
    }
  }

  // ----------------------------------------------------------------- lifecycle

  start(): void {
    const startsAt = Date.now() + MATCH_COUNTDOWN_MS;
    this.hooks.emitAll('match:start', {
      snapshot: this.snapshot(),
      players: this.publicPlayers(),
      mode: this.mode,
      startsAt,
      roomCode: this.roomCode,
    });
    this.after(MATCH_COUNTDOWN_MS, () => this.beginRound(0));
  }

  destroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const player of this.players.values()) {
      if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    }
    this.finished = true;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  get isFinished(): boolean {
    return this.finished;
  }

  // -------------------------------------------------------------------- rounds

  private beginRound(index: number): void {
    if (this.finished) return;
    this.roundIndex = index;
    this.phase = 'intro';

    const gameId = this.plan[index] as MiniGameId;
    const game = getMiniGame(gameId);
    const difficulty = difficultyForRound(index);
    const rng = createRng(`${this.id}:round:${index}`);
    const payload = game.generate({ difficulty, mode: this.mode, rng });
    const durationMs = game.durationMs(difficulty, this.mode);
    const startsAt = Date.now() + ROUND_INTRO_MS;

    this.round = {
      index,
      gameId,
      game,
      payload,
      difficulty,
      durationMs,
      startsAt,
      deadline: startsAt + durationMs,
      open: false,
      closed: false,
      submissions: new Map(),
    };

    const meta: RoundMeta = {
      roundIndex: index,
      gameId,
      title: game.title,
      instruction: game.instruction,
      coopInstruction: game.coopInstruction,
      category: game.category,
      accent: game.accent,
      icon: game.icon,
      difficulty,
      durationMs,
      startsAt,
    };
    this.hooks.emitAll('round:intro', meta);
    this.after(ROUND_INTRO_MS, () => this.openRound());
  }

  private openRound(): void {
    const round = this.round;
    if (!round || this.finished) return;
    round.open = true;
    round.startsAt = Date.now();
    round.deadline = round.startsAt + round.durationMs;
    this.phase = 'playing';

    for (const player of this.players.values()) {
      this.hooks.emitToPlayer(player.playerId, 'round:start', {
        roundIndex: round.index,
        payload: round.game.viewFor(round.payload, player.slot, this.mode),
        durationMs: round.durationMs,
        startsAt: round.startsAt,
        deadline: round.deadline,
      });
    }
    this.after(round.durationMs + 120, () => this.closeRound());
  }

  submitAnswer(
    playerId: string,
    roundIndex: number,
    answer: unknown,
    clientElapsedMs: number,
  ): { accepted: boolean; reason?: string } {
    const round = this.round;
    const player = this.players.get(playerId);
    if (!round || !player) return { accepted: false, reason: 'no active round' };
    if (!round.open || round.closed) return { accepted: false, reason: 'round is closed' };
    if (round.index !== roundIndex) return { accepted: false, reason: 'stale round' };
    if (round.submissions.has(playerId)) return { accepted: false, reason: 'already answered' };
    if (player.eliminated) return { accepted: false, reason: 'eliminated' };

    const serverElapsedMs = Math.max(0, Math.min(round.durationMs, Date.now() - round.startsAt));
    const evaluation = round.game.isValidAnswer(answer)
      ? round.game.evaluate(round.payload, answer, player.slot, this.mode, {
          elapsedMs: serverElapsedMs,
          durationMs: round.durationMs,
        })
      : { correct: false, accuracy: 0 };

    round.submissions.set(playerId, {
      answer,
      clientElapsedMs,
      serverElapsedMs,
      correct: evaluation.correct,
      accuracy: evaluation.accuracy,
    });

    // Partners learn *that* you answered, never *what* you answered.
    for (const other of this.players.values()) {
      if (other.playerId === playerId) continue;
      this.hooks.emitToPlayer(other.playerId, 'round:progress', { playerId, answered: true });
    }

    const pending = [...this.players.values()].filter(
      (p) => !p.eliminated && p.connected && !round.submissions.has(p.playerId),
    );
    if (pending.length === 0) this.after(260, () => this.closeRound());
    return { accepted: true };
  }

  private closeRound(): void {
    const round = this.round;
    if (!round || round.closed || this.finished) return;
    round.closed = true;
    round.open = false;
    this.phase = 'result';

    const outcomes: PlayerRoundOutcome[] = [];
    const active = [...this.players.values()].filter((p) => !p.eliminated);

    for (const player of active) {
      const submission = round.submissions.get(player.playerId);
      const answered = Boolean(submission);
      const correct = submission?.correct ?? false;
      const accuracy = submission?.accuracy ?? 0;
      const responseMs = submission ? submission.serverElapsedMs : null;

      let points = 0;
      if (correct) {
        points = computeRoundScore({
          difficulty: round.difficulty,
          responseMs: responseMs ?? round.durationMs,
          durationMs: round.durationMs,
          accuracy,
          streak: player.streak,
        }).total;
        player.score += points;
        player.correct += 1;
        player.streak += 1;
        player.bestStreak = Math.max(player.bestStreak, player.streak);
        if (responseMs !== null) player.responseTimes.push(responseMs);
      } else {
        player.wrong += 1;
        player.streak = 0;
      }

      outcomes.push({
        playerId: player.playerId,
        answered,
        correct,
        accuracy,
        responseMs,
        points,
        livesLost: 0,
      });
    }

    // Lives: Versus is per player, Co-op shares a pool and only punishes a
    // double miss — the mode is meant to reward covering for each other.
    let syncBonus = 0;
    if (this.mode === 'coop') {
      const everyoneWrong = outcomes.length > 0 && outcomes.every((o) => !o.correct);
      if (everyoneWrong) {
        this.teamLives = Math.max(0, this.teamLives - 1);
        for (const outcome of outcomes) outcome.livesLost = 1;
      }
      const allCorrect = outcomes.length > 1 && outcomes.every((o) => o.correct);
      if (allCorrect) {
        syncBonus = SYNC_BONUS;
        for (const player of active) player.score += Math.round(SYNC_BONUS / active.length);
      }
      for (const player of this.players.values()) player.lives = this.teamLives;
      this.teamScore = [...this.players.values()].reduce((sum, p) => sum + p.score, 0);
    } else {
      for (const outcome of outcomes) {
        if (outcome.correct) continue;
        const player = this.players.get(outcome.playerId);
        if (!player) continue;
        player.lives = Math.max(0, player.lives - 1);
        outcome.livesLost = 1;
        if (player.lives === 0) player.eliminated = true;
      }
    }

    const lastRound = round.index >= this.plan.length - 1 || round.index >= TOTAL_ROUNDS - 1;
    const outOfLives =
      this.mode === 'coop'
        ? this.teamLives <= 0
        : [...this.players.values()].some((p) => p.eliminated);
    const matchOver = lastRound || outOfLives;
    const nextRoundAt = matchOver ? null : Date.now() + ROUND_RESULT_MS;

    for (const player of this.players.values()) {
      this.hooks.emitToPlayer(player.playerId, 'round:result', {
        roundIndex: round.index,
        outcomes,
        solution: round.game.solutionFor(round.payload, player.slot, this.mode),
        syncBonus,
        snapshot: this.snapshot(),
        nextRoundAt,
      });
    }

    if (matchOver) {
      this.after(ROUND_RESULT_MS, () => this.finish(outOfLives ? 'lives' : 'completed'));
    } else {
      this.after(ROUND_RESULT_MS, () => this.beginRound(round.index + 1));
    }
  }

  // --------------------------------------------------------------- connections

  setConnected(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);
    if (!player || this.finished) return;
    player.connected = connected;
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
    for (const other of this.players.values()) {
      if (other.playerId === playerId) continue;
      this.hooks.emitToPlayer(other.playerId, 'player:connection', {
        playerId,
        connected,
        graceMs: connected ? 0 : RECONNECT_GRACE_MS,
      });
    }
    if (!connected && !this.solo) {
      player.disconnectTimer = setTimeout(() => this.finish('disconnect', playerId), RECONNECT_GRACE_MS);
      this.timers.add(player.disconnectTimer);
    }
  }

  /** Re-sends everything a returning player needs to keep playing. */
  resume(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || this.finished) return;
    this.hooks.emitToPlayer(playerId, 'match:start', {
      snapshot: this.snapshot(),
      players: this.publicPlayers(),
      mode: this.mode,
      startsAt: Date.now(),
      roomCode: this.roomCode,
    });
    const round = this.round;
    if (!round) return;
    if (round.open && !round.closed) {
      this.hooks.emitToPlayer(playerId, 'round:start', {
        roundIndex: round.index,
        payload: round.game.viewFor(round.payload, player.slot, this.mode),
        durationMs: round.durationMs,
        startsAt: round.startsAt,
        deadline: round.deadline,
      });
    }
  }

  leave(playerId: string): void {
    if (this.finished) return;
    this.finish('forfeit', playerId);
  }

  // --------------------------------------------------------------------- state

  private publicPlayers(): PublicPlayer[] {
    return [...this.players.values()].map((p) => ({
      id: p.playerId,
      username: p.username,
      avatarId: p.avatarId,
      level: p.level,
      slot: p.slot,
      isHost: false,
      ready: true,
      connected: p.connected,
    }));
  }

  private playerState(player: PlayerRuntime): MatchPlayerState {
    return {
      playerId: player.playerId,
      slot: player.slot,
      score: player.score,
      lives: player.lives,
      correct: player.correct,
      wrong: player.wrong,
      streak: player.streak,
      bestStreak: player.bestStreak,
      avgResponseMs: averageOf(player.responseTimes),
      answeredThisRound: Boolean(this.round?.submissions.has(player.playerId)),
      eliminated: player.eliminated,
    };
  }

  snapshot(): MatchSnapshot {
    return {
      matchId: this.id,
      mode: this.mode,
      roundIndex: Math.max(0, this.roundIndex),
      totalRounds: Math.min(TOTAL_ROUNDS, this.plan.length),
      phase: this.phase,
      players: [...this.players.values()].map((p) => this.playerState(p)),
      teamLives: this.mode === 'coop' ? this.teamLives : null,
      teamScore: this.mode === 'coop' ? this.teamScore : null,
    };
  }

  private finish(reason: MatchResult['reason'], offendingPlayerId?: string): void {
    if (this.finished) return;
    this.finished = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.phase = 'ended';

    const roster = [...this.players.values()];
    let winnerId: string | null = null;

    if (this.mode === 'versus' && !this.solo) {
      if ((reason === 'forfeit' || reason === 'disconnect') && offendingPlayerId) {
        winnerId = roster.find((p) => p.playerId !== offendingPlayerId)?.playerId ?? null;
      } else {
        const sorted = [...roster].sort((a, b) => {
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          return b.score - a.score;
        });
        const [first, second] = sorted;
        if (first && second) {
          winnerId =
            first.score === second.score && first.eliminated === second.eliminated
              ? null
              : first.playerId;
        } else winnerId = first?.playerId ?? null;
      }
    }

    const teamVictory =
      this.mode === 'coop'
        ? reason === 'completed' && this.teamLives > 0
        : null;

    const result: MatchResult = {
      matchId: this.id,
      mode: this.mode,
      reason,
      roundsPlayed: Math.max(0, this.roundIndex + 1),
      winnerId,
      teamVictory,
      teamScore: this.mode === 'coop' ? this.teamScore : null,
      players: roster.map((p) => ({
        playerId: p.playerId,
        username: p.username,
        avatarId: p.avatarId,
        slot: p.slot,
        score: p.score,
        correct: p.correct,
        wrong: p.wrong,
        bestStreak: p.bestStreak,
        avgResponseMs: averageOf(p.responseTimes),
        livesLeft: p.lives,
        xpGained: 0,
      })),
      unlockedAchievements: [],
      finishedAt: new Date().toISOString(),
    };

    this.hooks.onFinished(result, this);
  }

  private after(ms: number, fn: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }
}

function averageOf(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
