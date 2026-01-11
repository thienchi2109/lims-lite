---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation. Auto-invokes planning-pipeline after design."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue, then automatically transition to implementation planning.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

**This skill auto-invokes planning-pipeline after design completion.**

## The Process

**Understanding the idea:**
- Check out the current project state first (files, docs, recent commits)
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**
- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

## After the Design (Automatic Pipeline)

**Step 1: Documentation**
- Write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`
- Use elements-of-style:writing-clearly-and-concisely skill if available
- Commit the design document to git

**Step 2: Auto-invoke Planning Pipeline**

Once the design document is committed, **automatically invoke planning-pipeline**:

```
Skill tool -> skill: planning-pipeline
```

Announce: "Design complete. Now invoking planning-pipeline to create the implementation plan."

The planning-pipeline will then:
1. Assess scope (OpenSpec vs Quick-plan path)
2. Create plan artifacts (using writing-plans if Quick-plan path)
3. Get user approval
4. Ingest tasks into Beads with dependencies
5. Offer execution method choice

**Do NOT ask "Ready to set up for implementation?" - proceed automatically.**

## Workflow Diagram

```
Brainstorming Flow:

  Understand Idea
       |
       v
  Explore Approaches (2-3 options)
       |
       v
  Present Design (sections)
       |
       v
  Write design.md + git commit
       |
       v
  [AUTO] Invoke planning-pipeline
       |
       v
  Scope Assessment -> Plan Creation
       |
       v
  Beads Ingestion -> Execution
```

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
- **Seamless handoff** - Auto-invoke pipeline without asking

## Skip Planning Option

If user explicitly says they only want the design (not implementation), skip the auto-invoke:
- "Just the design, no implementation plan"
- "Design only"
- "Skip planning"

In these cases, end after committing the design document.

## Example Flow

```
User: "I want to add a feature for X"

[Brainstorming phase - questions, approaches, design sections]

User: "Ready to commit the design?"

[Commit design.md]

Announce: "Design complete. Now invoking planning-pipeline to create the implementation plan."

[Auto-invoke planning-pipeline]

The planning-pipeline will then:
1. Assess scope (OpenSpec vs Quick-plan path)
2. Create plan artifacts (using writing-plans if Quick-plan path)
3. Get user approval
4. Ingest tasks into Beads with dependencies
5. Offer execution method choice

[End of example flow]
```