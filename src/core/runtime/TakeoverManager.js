export var TakeoverReason;
(function (TakeoverReason) {
    TakeoverReason["USER_KEYPRESS"] = "user_keypress";
    TakeoverReason["USER_CLICK"] = "user_click";
    TakeoverReason["USER_MOUSE"] = "user_mouse";
    TakeoverReason["USER_REMOTE"] = "user_remote";
})(TakeoverReason || (TakeoverReason = {}));
const MAX_LISTENERS = 100;
export class TakeoverManager {
    takeoverState = null;
    listeners = new Set();
    addListener(listener) {
        if (this.listeners.size >= MAX_LISTENERS) {
            const oldest = this.listeners.keys().next().value;
            if (oldest) {
                this.listeners.delete(oldest);
                console.log('[TakeoverManager] Max listeners reached, removed oldest');
            }
        }
        this.listeners.add(listener);
    }
    resumeFromTakeover(action) {
        console.log(`[TakeoverManager] Resuming from takeover`);
        if (action) {
            console.log(`[TakeoverManager] User action:`, action);
        }
        this.takeoverState = null;
        this.notifyListeners();
    }
    getTakeoverState() {
        return this.takeoverState;
    }
    isInTakeover() {
        return this.takeoverState !== null;
    }
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    destroy() {
        this.listeners.clear();
        this.takeoverState = null;
        console.log('[TakeoverManager] Destroyed');
    }
    notifyListeners() {
        this.listeners.forEach((listener) => {
            try {
                listener(this.takeoverState);
            }
            catch (err) {
                console.error('[TakeoverManager] Listener error:', err);
            }
        });
    }
}
export default TakeoverManager;
