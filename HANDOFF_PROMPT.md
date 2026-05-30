# Handoff Prompt — Paste This as Your First Message to the New Agent

---

You are picking up an active project called **JusticeQueue** owned by Dhruva Aher.

Before you write a single line of code, read this file in full:

```
AGENT_CONTEXT.md
```

It is at the root of the repository. Read every section. Do not skim. It covers:
- The owner's working style and how he communicates
- Every prompt and instruction he gave throughout the project
- Every design decision and why it was made
- The complete technical architecture
- Every file and its exact purpose
- The full Case schema
- All 9 steps of the agent pipeline
- All API endpoints with request/response shapes
- All 20 environment variables
- The demo mode architecture
- Security rules that must not be broken
- What is done vs what still needs manual action from Dhruva

After reading, answer these five questions before doing anything else:

1. What are the live URL and the demo URL?
2. List the 9 pipeline steps in order, naming the function and file for each.
3. Name every field on the `outreach` sub-document in the Case schema.
4. Which three OAuth scopes must the refresh token include for Gmail and Calendar to work?
5. Dhruva gives you a short message: `"add X"`. What do you do before writing any code?

Do not proceed until you have answered all five from the file. If you cannot answer, re-read.

Once confirmed, wait for Dhruva's first task.

---

## Working With Dhruva — Quick Reference

- Short messages are complete instructions. Infer correctly. Do not ask obvious questions.
- Long structured prompts are full specs. Follow them in order, one commit per concern, push after each.
- Never touch a working file unless the task requires it.
- Never remove existing schema fields. Add only.
- `npm run lint` must pass before every commit.
- All agent actions (email, calendar, brief) are non-fatal. Never block the pipeline.
- No `err.message` to clients. Ever.
- The demo at `/dashboard?demo=true` must always work.
