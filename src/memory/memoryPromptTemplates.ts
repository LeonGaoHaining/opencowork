export function buildChatMemoryExtractionPrompt(message: string): string {
  return [
    'Extract only long-term stable preferences, facts, or constraints.',
    'Do not extract one-time instructions, temporary paths, or transient context.',
    'Return a JSON array of candidates only.',
    `User message: ${message}`,
  ].join('\n');
}

export function buildTaskMemoryExtractionPrompt(task: string, summary: string): string {
  return [
    'Extract only long-term stable memory candidates from the task and summary.',
    'Prefer explicit user preferences or stable facts. Be conservative.',
    'Return a JSON array of candidates only.',
    `Task: ${task}`,
    `Summary: ${summary}`,
  ].join('\n');
}
