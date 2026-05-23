export const INPUT_FLAGS = {
  THROTTLE: 1 << 0,
  BRAKE: 1 << 1,
  LEFT: 1 << 2,
  RIGHT: 1 << 3,
  DRIFT: 1 << 4,
  LOOK_BACK: 1 << 5,
} as const;

export type InputFlags = number;

export interface InputCommand {
  seq: number;
  tick: number;
  flags: InputFlags;
}

export const hasFlag = (flags: InputFlags, flag: number): boolean => (flags & flag) !== 0;
