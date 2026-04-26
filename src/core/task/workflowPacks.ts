import { TaskTemplate, TaskWorkflowPack } from './types';

function createWorkflowPackTemplateId(packId: string, templateId: string): string {
  return `workflow-pack-${packId}-${templateId}`;
}

export const OFFICIAL_WORKFLOW_PACKS: TaskWorkflowPack[] = [
  {
    id: 'ecommerce-ops',
    name: 'E-commerce Ops',
    category: 'browser-heavy',
    description: 'Browser-first workflow pack for store operations and后台核查。',
    summary: 'Covers catalog checks, campaign QA, and order-side evidence capture.',
    outcomes: ['Catalog audit notes', 'Promotion QA evidence', 'Reusable ops checklist'],
    recommendedSkills: ['browser-search', 'file-organizer'],
    templates: [
      {
        id: 'catalog-audit',
        name: 'Catalog Audit Sweep',
        description: 'Review product listings, pricing, and publish blockers across the current store backend.',
        prompt:
          'Open the current e-commerce backend and audit the target product set. Check title quality, price consistency, inventory flags, and publish blockers. Summarize issues with evidence links or screenshots when possible.',
        executionProfile: 'mixed',
        recommendedSkills: ['browser-search'],
      },
      {
        id: 'campaign-qa',
        name: 'Promotion Campaign QA',
        description: 'Validate a campaign page, discount settings, and checkout-facing messaging before launch.',
        prompt:
          'Review the active promotion workflow in the current backend. Verify campaign dates, discount math, visible copy, and any warning states before launch. Return a concise go/no-go summary with follow-up actions.',
        executionProfile: 'mixed',
        recommendedSkills: ['browser-search'],
      },
    ],
  },
  {
    id: 'saas-admin',
    name: 'SaaS Admin Ops',
    category: 'browser-heavy',
    description: 'Operational workflow pack for admin consoles and support dashboards.',
    summary: 'Focuses on tenant checks, incident evidence, and change validation in admin UIs.',
    outcomes: ['Tenant health summary', 'Incident triage notes', 'Change verification record'],
    recommendedSkills: ['browser-search', 'issue-tracker'],
    templates: [
      {
        id: 'tenant-health-check',
        name: 'Tenant Health Check',
        description: 'Inspect a tenant or workspace in an admin console and summarize warnings, quotas, and recent failures.',
        prompt:
          'Inspect the current SaaS admin console for the target tenant or workspace. Check service status, quota warnings, recent failures, and pending admin actions. Return an operator-ready status summary.',
        executionProfile: 'browser-first',
        recommendedSkills: ['browser-search'],
      },
      {
        id: 'change-verification',
        name: 'Admin Change Verification',
        description: 'Walk through a recent configuration change and verify the UI reflects the expected state.',
        prompt:
          'Verify the recent admin configuration change in the current browser session. Compare intended settings with visible UI state, capture mismatches, and note any risky follow-up steps that need approval.',
        executionProfile: 'mixed',
        recommendedSkills: ['browser-search', 'issue-tracker'],
      },
    ],
  },
  {
    id: 'data-collection',
    name: 'Data Collection',
    category: 'browser-heavy',
    description: 'Structured browser workflows for collection, reconciliation, and reporting.',
    summary: 'Supports repeatable collection tasks that end in reusable structured outputs.',
    outcomes: ['Collected rows', 'Submission checklist', 'Structured report draft'],
    recommendedSkills: ['browser-search', 'spreadsheet-helper'],
    templates: [
      {
        id: 'ops-dashboard-scan',
        name: 'Ops Dashboard Scan',
        description: 'Scan an operations dashboard and extract a structured daily summary from the visible metrics and alerts.',
        prompt:
          'Review the active operations dashboard in the browser. Extract the important metrics, alerts, and anomalies into a concise structured daily summary that can be reused in reports.',
        executionProfile: 'browser-first',
        recommendedSkills: ['browser-search', 'spreadsheet-helper'],
      },
      {
        id: 'form-fill-checklist',
        name: 'Form Fill Checklist',
        description: 'Prepare and validate a browser-based filing or submission workflow before final submission.',
        prompt:
          'Inspect the current browser-based form workflow, identify missing required inputs, validate visible values, and prepare a final submission checklist without sending anything irreversible.',
        executionProfile: 'mixed',
        recommendedSkills: ['browser-search'],
      },
    ],
  },
];

export function listOfficialWorkflowPacks(): TaskWorkflowPack[] {
  return OFFICIAL_WORKFLOW_PACKS;
}

export function getOfficialWorkflowPack(packId: string): TaskWorkflowPack | null {
  return OFFICIAL_WORKFLOW_PACKS.find((pack) => pack.id === packId) || null;
}

export function buildTemplatesFromWorkflowPack(pack: TaskWorkflowPack): TaskTemplate[] {
  const now = Date.now();
  return pack.templates.map((template) => ({
    id: createWorkflowPackTemplateId(pack.id, template.id),
    name: template.name,
    description: template.description,
    origin: {
      runId: `${pack.id}:${template.id}`,
      source: 'chat',
      executionMode: template.executionProfile === 'mixed' ? 'hybrid' : 'dom',
    },
    inputSchema: template.inputSchema || {
      prompt: 'Prompt',
    },
    defaultInput: {
      prompt: template.prompt,
      ...(template.defaultInput || {}),
    },
    executionProfile: template.executionProfile,
    recommendedSkills: Array.from(
      new Set([...(pack.recommendedSkills || []), ...(template.recommendedSkills || [])])
    ),
    createdAt: now,
    updatedAt: now,
  }));
}

export function createWorkflowPackInstallResult(pack: TaskWorkflowPack, templates: TaskTemplate[]): {
  packId: string;
  installedTemplateIds: string[];
  installedCount: number;
  selectedTemplateId: string | null;
} {
  return {
    packId: pack.id,
    installedTemplateIds: templates.map((template) => template.id),
    installedCount: templates.length,
    selectedTemplateId: templates[0]?.id || null,
  };
}

export function createEmptyWorkflowPackInstallResult(packId: string): {
  packId: string;
  installedTemplateIds: string[];
  installedCount: number;
  selectedTemplateId: string | null;
} {
  return {
    packId,
    installedTemplateIds: [],
    installedCount: 0,
    selectedTemplateId: null,
  };
}
