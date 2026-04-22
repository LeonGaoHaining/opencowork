import { UIAction } from '../types/visualProtocol';

const KEY_MAP: Record<string, string> = {
  ENTER: 'Enter',
  RETURN: 'Enter',
  ESC: 'Escape',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  SPACE: 'Space',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  DEL: 'Delete',
  HOME: 'Home',
  END: 'End',
  PAGEUP: 'PageUp',
  PAGEDOWN: 'PageDown',
  UP: 'ArrowUp',
  ARROWUP: 'ArrowUp',
  DOWN: 'ArrowDown',
  ARROWDOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  ARROWLEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  ARROWRIGHT: 'ArrowRight',
  CTRL: 'Control',
  CONTROL: 'Control',
  SHIFT: 'Shift',
  OPTION: 'Alt',
  ALT: 'Alt',
  META: 'Meta',
  CMD: 'Meta',
  COMMAND: 'Meta',
};

export function normalizeKey(key: string): string {
  return KEY_MAP[key.toUpperCase()] || key;
}

export function normalizeDragPath(
  path: UIAction['path']
): Array<[number, number]> {
  if (!Array.isArray(path)) {
    throw new Error('drag action requires a path array');
  }

  return path.map((point) => {
    if (Array.isArray(point) && point.length >= 2) {
      return [point[0], point[1]];
    }

    if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
      return [point.x as number, point.y as number];
    }

    throw new Error('drag path entries must be coordinate pairs or {x, y} objects');
  });
}

export function normalizeAction(action: UIAction): UIAction {
  if (action.type === 'keypress' && Array.isArray(action.keys)) {
    return {
      ...action,
      keys: action.keys.map((key) => normalizeKey(key)),
    };
  }

  return action;
}
