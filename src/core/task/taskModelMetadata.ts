import type { TaskSource, TaskVisualProviderSelection } from './types';
import type { TaskExecutionRoute } from './taskRouting';

export interface BuildTaskExecutionMetadataInput {
  source?: TaskSource;
  executionMode?: TaskExecutionRoute['executionMode'];
  templateId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  visualProvider?: TaskVisualProviderSelection | null;
  taskRouting?: TaskExecutionRoute | null;
  extra?: Record<string, unknown>;
}

export function buildTaskExecutionMetadata(input: BuildTaskExecutionMetadataInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...(input.extra || {}),
  };

  if (input.source) {
    metadata.source = input.source;
  }

  if (input.executionMode) {
    metadata.executionMode = input.executionMode;
  }

  if (input.templateId) {
    metadata.templateId = input.templateId;
  }

  if (input.sessionId) {
    metadata.sessionId = input.sessionId;
  }

  if (input.threadId) {
    metadata.threadId = input.threadId;
  }

  if (input.visualProvider) {
    metadata.visualProvider = input.visualProvider;
  }

  if (input.taskRouting) {
    metadata.taskRouting = input.taskRouting;
    if (input.taskRouting.visualProviderRequirements) {
      metadata.visualProviderRequirements = input.taskRouting.visualProviderRequirements;
    }
  }

  return metadata;
}
