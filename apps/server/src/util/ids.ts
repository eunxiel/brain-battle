import { randomBytes, randomUUID } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@brain-battle/shared';

export const newId = (): string => randomUUID();

export function newRoomCode(): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[(bytes[i] as number) % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
