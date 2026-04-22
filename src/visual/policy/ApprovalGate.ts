import { UIAction, VisualTaskContext } from '../types/visualProtocol';

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

export class RuleBasedApprovalGate implements ApprovalGate {
  async shouldPauseForApproval(actions: UIAction[], context: VisualTaskContext): Promise<boolean> {
    if (context.approvalPolicy?.enabled === false) {
      return false;
    }

    if (actions.some((action) => action.type === 'drag')) {
      return true;
    }

    const task = context.task.toLowerCase();
    return HIGH_IMPACT_KEYWORDS.some((keyword) => task.includes(keyword.toLowerCase()));
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
    return `Approval required before executing visual actions [${actionSummary}] for task: ${context.task}`;
  }
}
