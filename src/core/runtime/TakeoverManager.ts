export enum TakeoverReason {
  USER_KEYPRESS = 'user_keypress',
  USER_CLICK = 'user_click',
  USER_MOUSE = 'user_mouse',
  USER_REMOTE = 'user_remote',
}

export interface TakeoverState {
  reason: TakeoverReason;
  timestamp: number;
  currentNode: any;
  completedActions: any[];
  pendingNodes: any[];
  aiContext: {
    currentTask: string;
    conversationHistory: any[];
    variables: Record<string, any>;
  };
}

const MAX_LISTENERS = 100;

export class TakeoverManager {
  private takeoverState: TakeoverState | null = null;
  private listeners: Set<(state: TakeoverState | null) => void> = new Set();

  addListener(listener: (state: TakeoverState | null) => void): void {
    if (this.listeners.size >= MAX_LISTENERS) {
      const oldest = this.listeners.keys().next().value;
      if (oldest) {
        this.listeners.delete(oldest);
        console.log('[TakeoverManager] Max listeners reached, removed oldest');
      }
    }
    this.listeners.add(listener);
  }

  resumeFromTakeover(action?: any): void {
    console.log(`[TakeoverManager] Resuming from takeover`);

    if (action) {
      console.log(`[TakeoverManager] User action:`, action);
    }

    this.takeoverState = null;
    this.notifyListeners();
  }

  getTakeoverState(): TakeoverState | null {
    return this.takeoverState;
  }

  isInTakeover(): boolean {
    return this.takeoverState !== null;
  }

  removeListener(listener: (state: TakeoverState | null) => void): void {
    this.listeners.delete(listener);
  }

  destroy(): void {
    this.listeners.clear();
    this.takeoverState = null;
    console.log('[TakeoverManager] Destroyed');
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.takeoverState);
      } catch (err) {
        console.error('[TakeoverManager] Listener error:', err);
      }
    });
  }
}

export default TakeoverManager;
