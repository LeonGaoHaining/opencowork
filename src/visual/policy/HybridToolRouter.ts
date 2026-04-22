export interface HybridRouteInput {
  task: string;
  action?: 'click' | 'input' | 'wait' | 'extract' | 'goto' | 'screenshot';
  selector?: string;
  hasPriorDomFailure?: boolean;
  isVisualTask?: boolean;
  requiresStrictExtraction?: boolean;
}

export interface HybridRouteDecision {
  mode: 'dom' | 'cua' | 'hybrid';
  reason: string;
}

const VISUAL_KEYWORDS = [
  'click',
  'menu',
  'button',
  'dialog',
  'popup',
  'canvas',
  '像人一样',
  '视觉',
  '界面',
  '按钮',
  '弹窗',
  '菜单',
];

const GENERIC_SELECTOR_PATTERNS = [
  /^button$/i,
  /^input$/i,
  /^a$/i,
  /^div$/i,
  /^span$/i,
  /^form$/i,
  /^\[role=/i,
  /^button\[/i,
  /^input\[/i,
  /^a\[/i,
];

export class HybridToolRouter {
  decide(input: HybridRouteInput): HybridRouteDecision {
    if (input.requiresStrictExtraction) {
      return {
        mode: 'dom',
        reason: 'Strict extraction tasks should stay on the DOM-first path',
      };
    }

    if (input.hasPriorDomFailure) {
      return {
        mode: 'hybrid',
        reason: 'Previous DOM failure suggests visual fallback should be enabled',
      };
    }

    if (this.shouldUseVisualPrimary(input)) {
      return {
        mode: 'cua',
        reason: 'The action and selector hint suggest a visually ambiguous interaction',
      };
    }

    if (input.isVisualTask || this.containsVisualKeyword(input.task)) {
      return {
        mode: 'cua',
        reason: 'Task language suggests a visual interaction flow',
      };
    }

    return {
      mode: 'dom',
      reason: 'Default to DOM-first for text-centric and selector-stable tasks',
    };
  }

  private containsVisualKeyword(task: string): boolean {
    const normalized = task.toLowerCase();
    return VISUAL_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
  }

  private shouldUseVisualPrimary(input: HybridRouteInput): boolean {
    if (!input.action || !['click', 'input', 'wait'].includes(input.action)) {
      return false;
    }

    if (!input.selector) {
      return true;
    }

    const selector = input.selector.trim();

    if (!selector) {
      return true;
    }

    if (selector.includes('contains(') || selector.includes(',')) {
      return true;
    }

    if (GENERIC_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector))) {
      return true;
    }

    return false;
  }
}
