# REGRESSION CHECKLIST v3.0

## Purpose

This checklist verifies the main `SPEC v3.0` implementation after the recent feature work.

## Recommended Order

1. Interrupt / Restore
2. Skills
3. History / Search
4. Memory
5. MCP Client
6. MCP Sampling
7. MCP Server Mode

## 1. Skills

### Goal

Verify skill generation, installation, visibility, and reuse.

### Steps

1. Set `Trigger Threshold=1` in Settings.
2. Run a task with 3+ steps.
3. Confirm the skill generation prompt appears after task completion.
4. Click generate.
5. Open `SkillPanel` and verify the new skill is listed.
6. Run a similar task again.

### Expected Result

1. A skill generation prompt appears.
2. The generated skill is saved and visible in `SkillPanel`.
3. The agent can reuse the generated skill on a similar task.

## 2. Memory

### Goal

Verify persistent memory read/write and prompt injection.

### Steps

1. Call `memory:add` with a simple preference or fact.
2. Restart the application.
3. Run a new task related to that memory.
4. Test `memory:replace`.
5. Test `memory:remove`.
6. Test `memory:scan` with a deliberately unsafe string.

### Expected Result

1. Memory is persisted under `~/.opencowork/memories/`.
2. New tasks can reflect stored memory in behavior.
3. Replace/remove work correctly.
4. Unsafe content is rejected or flagged by scan.

## 3. History / Search

### Goal

Verify FTS5 search and summary flow.

### Steps

1. Run several tasks with different topics.
2. Open `HistoryPanel`.
3. Search with a keyword that should match one or more tasks.
4. Verify results match task content, steps, or output.
5. Click `总结`.
6. Test status and date filters.

### Expected Result

1. Search returns relevant tasks.
2. Search is not limited to task title only.
3. Summary returns a concise Chinese summary.
4. Filters affect both search results and summary scope.

## 4. Interrupt / Restore

### Goal

Verify save/restore flow for both main execution paths.

### Steps

1. Start a browser task.
2. Click `中断保存` during execution.
3. Open `恢复任务` and confirm the saved state appears in the list.
4. Click `恢复`.
5. Repeat for both:
   - `TaskEngine` path
   - `MainAgent` path

### Expected Result

1. Saved state is created successfully.
2. Restore resumes the task rather than starting from scratch when possible.
3. Browser state, page, and login/session are preserved as much as possible.

## 5. ESC / User Activity Interrupt

### Goal

Verify automatic interrupt behavior.

### Steps

1. Start a task in `executing` state.
2. Press `ESC`.
3. Start another task.
4. Manually click or interact in the app content area while it is running.

### Expected Result

1. `ESC` triggers interrupt and save.
2. User activity also triggers interrupt and save.
3. The saved state appears in the restore list.

## 6. Progressive Skill Loading

### Goal

Verify staged skill loading behavior.

### Steps

1. Install or generate several skills.
2. Run a task unrelated to those skills.
3. Run a task that should match a specific skill.
4. Execute the matched skill path.

### Expected Result

1. Unrelated tasks do not load all skills as active tools.
2. Matching tasks load only relevant skills.
3. Skill execution still succeeds with lazy full-skill loading.

## 7. MCP Client

### Goal

Verify MCP HTTP and stdio client flows.

### Steps

1. Open the `MCP` panel.
2. Add one HTTP MCP server.
3. Save and connect.
4. Confirm tools are listed.
5. Add one stdio MCP server.
6. Save and connect.
7. Verify:
   - `listTools`
   - `callTool`
   - `getResource`
8. Change the server tool set if supported.
9. Verify auto reload or refresh tools.

### Expected Result

1. Both HTTP and stdio servers can connect.
2. Tools are visible in the panel.
3. Tool calls and resource reads succeed.
4. Tool changes are detected by refresh or auto reload.

## 8. MCP Sampling

### Goal

Verify MCP sampling request handling.

### Steps

1. Enable MCP sampling in MCP settings.
2. Trigger a sampling request from an MCP server.
3. Verify the request returns LLM output.
4. Exceed configured request/token limits.
5. Send a request above `max_turns` / `maxToolRounds`.

### Expected Result

1. Valid sampling requests succeed.
2. Rate-limited requests are rejected.
3. Requests exceeding turn limits are rejected.

## 9. MCP Server Mode

### Goal

Verify OpenCowork as an MCP server.

### Steps

1. Open `MCP` panel.
2. Configure server port and start MCP server.
3. If auth is enabled, prepare a bearer token.
4. From an external client, request `GET /tools`.
5. Call the following tools if available:
   - `task:status`
   - `task:list`
   - `task:execute`
   - `browser:navigate`
   - `browser:screenshot`
   - `memory:read`
   - `skill:list`
6. If auth is enabled, retry without token.

### Expected Result

1. MCP server starts successfully.
2. Tool metadata is returned from `/tools`.
3. Exposed tools execute correctly.
4. Unauthorized requests are rejected when auth is enabled.

## 10. SkillRecorder

### Goal

Verify recorded skills follow the unified skill layout.

### Steps

1. Call `start_skill_recording`.
2. Execute several tool steps.
3. Call `finish_skill_recording`.
4. Check the output path.
5. Open `SkillPanel` and verify the skill is loaded.

### Expected Result

1. The recorded skill is saved at:
   `~/.opencowork/skills/agent-created/<skill>/SKILL.md`
2. The recorded skill can be loaded and reused.

## Pass Criteria

The regression pass is successful when:

1. All high-risk flows complete without blocking errors.
2. Save/restore works on both execution paths.
3. MCP HTTP and stdio paths both work.
4. Search, summary, and generated skills are usable from the UI.
