import { describe, expect, it } from 'vitest';
import { buildTaskExecutionMetadata } from '../taskModelMetadata';

describe('buildTaskExecutionMetadata', () => {
  it('merges standard task model fields with extra metadata', () => {
    const metadata = buildTaskExecutionMetadata({
      source: 'chat',
      executionMode: 'visual',
      templateId: 'template-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      visualProvider: {
        id: 'responses-computer',
        name: 'Responses Computer',
        score: 91,
        reasons: ['highest completion'],
        adapterMode: 'responses-computer',
      },
      taskRouting: {
        routeMode: 'cua',
        executionMode: 'visual',
        reason: 'visual route',
        explicit: false,
        source: 'chat',
        visualProviderRequirements: {
          builtInComputerTool: true,
          structuredOutput: true,
        },
        visualProvider: null,
      },
      extra: {
        userId: 'user-1',
        attachments: [{ name: 'file.txt' }],
      },
    });

    expect(metadata).toMatchObject({
      source: 'chat',
      executionMode: 'visual',
      templateId: 'template-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      userId: 'user-1',
    });
    expect(metadata.visualProvider).toMatchObject({
      id: 'responses-computer',
      name: 'Responses Computer',
    });
    expect(metadata.taskRouting).toMatchObject({
      executionMode: 'visual',
      reason: 'visual route',
    });
    expect(metadata.visualProviderRequirements).toMatchObject({
      builtInComputerTool: true,
      structuredOutput: true,
    });
  });
});
