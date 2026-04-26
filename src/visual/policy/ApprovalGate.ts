import { ApprovalAuditSnapshot, UIAction, VisualTaskContext } from '../types/visualProtocol';

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
}

export interface ApprovalGate {
  shouldPauseForApproval(actions: UIAction[], context: VisualTaskContext): Promise<boolean>;

  requestApproval(actions: UIAction[], context: VisualTaskContext): Promise<ApprovalDecision>;
}

export class NoopApprovalGate implements ApprovalGate {
  async shouldPauseForApproval(_actions: UIAction[], _context: VisualTaskContext): Promise<boolean> {
    return false;
  }

  async requestApproval(_actions: UIAction[], _context: VisualTaskContext): Promise<ApprovalDecision> {
    return { approved: true };
  }
}

const HIGH_IMPACT_KEYWORDS = [
  'login',
  'sign in',
  'submit',
  'publish',
  'send',
  'delete',
  'remove',
  'payment',
  'pay',
  'buy',
  'purchase',
  'upload',
  'authorize',
  'permission',
  '登录',
  '提交',
  '发布',
  '发送',
  '删除',
  '支付',
  '购买',
  '上传',
  '授权',
  '权限',
];

const HIGH_IMPACT_ACTION_TYPES = new Set<UIAction['type']>(['drag']);

function normalizeText(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function containsKeyword(source: string | undefined, keywords: string[]): string[] {
  const normalized = normalizeText(source);
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function containsHighImpactIntent(context: VisualTaskContext): string[] {
  const taskMatches = containsKeyword(context.task, HIGH_IMPACT_KEYWORDS);
  const titleMatches = containsKeyword(context.page.title, HIGH_IMPACT_KEYWORDS);
  const urlMatches = containsKeyword(context.page.url, HIGH_IMPACT_KEYWORDS);

  const configuredKeywords = (context.approvalPolicy?.highImpactActions || []).flatMap((keyword) =>
    containsKeyword(context.task, [keyword])
  );

  return Array.from(new Set([...taskMatches, ...titleMatches, ...urlMatches, ...configuredKeywords]));
}

export function containsHighImpactActions(actions: UIAction[]): string[] {
  const reasons: string[] = [];

  if (actions.some((action) => HIGH_IMPACT_ACTION_TYPES.has(action.type))) {
    reasons.push('contains drag action');
  }

  if (actions.some((action) => action.type === 'keypress' && (action.keys || []).length > 0)) {
    reasons.push('contains keypress action');
  }

  if (actions.some((action) => action.type === 'type' && normalizeText(action.text).length > 0)) {
    reasons.push('contains text entry action');
  }

  if (actions.length >= 3) {
    reasons.push('contains large multi-step action batch');
  }

  return reasons;
}

export function buildApprovalAudit(actions: UIAction[], context: VisualTaskContext): ApprovalAuditSnapshot {
  return {
    matchedIntentKeywords: containsHighImpactIntent(context),
    actionRiskReasons: containsHighImpactActions(actions),
    actionTypes: Array.from(new Set(actions.map((action) => action.type))),
  };
}

export class RuleBasedApprovalGate implements ApprovalGate {
  async shouldPauseForApproval(actions: UIAction[], context: VisualTaskContext): Promise<boolean> {
    if (context.approvalPolicy?.enabled === false) {
      return false;
    }

    const { matchedIntentKeywords, actionRiskReasons } = buildApprovalAudit(actions, context);

    return matchedIntentKeywords.length > 0 || actionRiskReasons.length > 0;
  }

  async requestApproval(actions: UIAction[], context: VisualTaskContext): Promise<ApprovalDecision> {
    const reason = this.buildReason(actions, context);
    return {
      approved: false,
      reason,
    };
  }

  private buildReason(actions: UIAction[], context: VisualTaskContext): string {
    const actionSummary = actions.map((action) => action.type).join(', ');
    const { matchedIntentKeywords, actionRiskReasons } = buildApprovalAudit(actions, context);
    const reasons = [
      ...(matchedIntentKeywords.length > 0
        ? [`high-impact intent matched: ${matchedIntentKeywords.join(', ')}`]
        : []),
      ...actionRiskReasons,
    ];

    return `Approval required before executing visual actions [${actionSummary}] for task: ${context.task}${reasons.length > 0 ? ` (${reasons.join('; ')})` : ''}`;
  }
}
