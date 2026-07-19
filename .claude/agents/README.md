# Project Subagents — The Agency

Curated Claude Code subagents for H.I.M., selected from
[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)
("The Agency", MIT license, © 2025 AgentLand Contributors) at upstream commit
`459dce837db3bdfdc4763d3fefd1fd854e73c8f1`.

Claude Code picks these up automatically from `.claude/agents/`. Invoke one by
name in any session, e.g. *"Use the Mobile Release Engineer agent to prep the
next TestFlight build."*

## Engineering / Design / Testing / Security

Chosen for this codebase specifically — a Vite + React 19 web app with a
Supabase backend, Capacitor iOS/Android wrappers, Vitest/Playwright tests, and
an active App Store / Play Store release track:

| Agent | File | Fits |
|-------|------|------|
| Frontend Developer | `engineering-frontend-developer.md` | React 19 / Tailwind UI work in `src/` |
| Backend Architect | `engineering-backend-architect.md` | Supabase schema, RPCs, Edge Functions, Vercel API routes |
| Database Optimizer | `engineering-database-optimizer.md` | Postgres migrations, indexes, RLS-adjacent query tuning |
| Realtime Collaboration Engineer | `engineering-realtime-collaboration-engineer.md` | Supabase Realtime channels, presence, offline outbox |
| Mobile App Builder | `engineering-mobile-app-builder.md` | Capacitor iOS/Android work, biometric auth, push |
| Mobile Release Engineer | `engineering-mobile-release-engineer.md` | App Store Connect / Play Console submissions, phased rollouts |
| Code Reviewer | `engineering-code-reviewer.md` | PR review passes |
| UI Designer | `design-ui-designer.md` | Retro-AIM design system and component consistency |
| Whimsy Injector | `design-whimsy-injector.md` | The playful micro-interactions the retro brand runs on |
| Test Automation Engineer | `testing-test-automation-engineer.md` | Playwright E2E suite in `tests/e2e/` |
| Accessibility Auditor | `testing-accessibility-auditor.md` | WCAG passes ahead of store review |
| Application Security Engineer | `security-appsec-engineer.md` | Auth, RLS, trust & safety surface |

## Product

The full upstream Product division:

| Agent | File | Fits |
|-------|------|------|
| Product Manager | `product-manager.md` | PRDs, roadmap, GTM, launch discipline |
| Sprint Prioritizer | `product-sprint-prioritizer.md` | Backlog and sprint planning (RICE, Kano) |
| Feedback Synthesizer | `product-feedback-synthesizer.md` | App reviews, support signal, feature triage |
| Trend Researcher | `product-trend-researcher.md` | Market and competitor intelligence |
| Behavioral Nudge Engine | `product-behavioral-nudge-engine.md` | Notification cadence, retention nudges |

## Marketing

The subset of the upstream Marketing division relevant to a US consumer
social app (the division's China-platform cluster — Douyin, Weibo, WeChat,
Xiaohongshu, Zhihu, Baidu, Bilibili, Kuaishou, China e-commerce, and the
Chinese-platform Multi-Platform Publisher — plus niche roles like Book
Co-Author and podcast/LinkedIn specialists were intentionally left out):

| Agent | File |
|-------|------|
| App Store Optimizer | `marketing-app-store-optimizer.md` |
| SEO Specialist | `marketing-seo-specialist.md` |
| AEO Foundations Architect | `marketing-aeo-foundations.md` |
| AI Citation Strategist | `marketing-ai-citation-strategist.md` |
| Agentic Search Optimizer | `marketing-agentic-search-optimizer.md` |
| Content Creator | `marketing-content-creator.md` |
| Growth Hacker | `marketing-growth-hacker.md` |
| Social Media Strategist | `marketing-social-media-strategist.md` |
| TikTok Strategist | `marketing-tiktok-strategist.md` |
| Instagram Curator | `marketing-instagram-curator.md` |
| Twitter Engager | `marketing-twitter-engager.md` |
| X/Twitter Intelligence Analyst | `marketing-x-twitter-intelligence-analyst.md` |
| Reddit Community Builder | `marketing-reddit-community-builder.md` |
| Email Marketing Strategist | `marketing-email-strategist.md` |
| PR & Communications Manager | `marketing-pr-communications-manager.md` |

## Provenance notes

- Files are verbatim copies from upstream, with two exceptions:
  `engineering-mobile-app-builder.md` and `marketing-app-store-optimizer.md`
  had corrupted (mojibake) emoji in their section headers upstream; those were
  restored to the emoji used by the rest of the collection. No wording was
  changed.
- To add more agents, pull from the upstream repo (230+ available across
  Engineering, Design, Marketing, Product, Testing, Security, and more) and
  drop the `.md` file in this directory.
