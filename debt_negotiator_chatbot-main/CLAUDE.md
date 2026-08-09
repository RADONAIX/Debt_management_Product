# CLAUDE.md — Negotiator API

A debt-collection negotiation agent exposed as an HTTP API, implementing the
system design from *"Everyone is unique: Towards Behaviorally Heterogeneous
Negotiation Dialogue Systems for Debt Collection"* (DebtBench / DebtGPT, arXiv
2607.25218v1) **using prompted OpenAI models only — no fine-tuning.**

Read this file at the start of every session. It is the source of truth for
architecture, domain rules, and constraints. Requirements marked **[paper]** trace
to the source; **[eng]** are production decisions; **[scope]** marks a deliberate
divergence from the paper.

---

## 1. Scope

**In scope.** A negotiator API: given a debtor persona, account facts, and
conversation history, return the next collector turn — strategy-labelled,
policy-validated, guardrail-checked, and auditable. Plus the evaluation harness
and debtor simulator needed to prove it works.

**Explicitly out of scope. [scope]**

- CFPO training, DPO, LoRA, any fine-tuning. The paper's own results show a
  prompted GPT-4o-class model beats DebtGPT-8B on every negotiation-ability
  metric; the fine-tune existed to prove an 8B open model could compete, which is
  not our goal. **[paper — Table 2]**
- Best-of-N candidate generation and live judge scoring in the request path.
  Deferred, not rejected — see §5.
- Per-candidate forward simulation in the request path. Too slow and too expensive
  for a live API. Retained in the eval harness, where it is simply how a dialogue
  is run to completion.
- Any UI. This is an API.
- Voice. The orchestrator stays channel-agnostic so a voice adapter remains
  possible later, but nothing here assumes or targets audio.

**Not a support chatbot.** The counterparty is non-cooperative and may be evasive
or hostile; the conversation has a structured terminal state; and there are two
competing objectives, not one.

---

## 2. Architectural laws

Not up for negotiation during implementation. If a task appears to require
breaking one, stop and raise it.

1. **The policy engine is deterministic and lives outside the model.** Allowable
   discount tiers, minimum upfront ratios, payment windows, and installment terms
   are business rules validated in code. The model proposes within the envelope;
   it never defines the envelope. **[eng]**

2. **A prompt is guidance, not enforcement.** This is the empirical finding of the
   source paper, not a stylistic preference. Every model in Table 2 received the
   full concession rules in its prompt — *"stay firm on discounts (usually 0%)"*,
   *"push for at least 25%"* — and over-conceded anyway. Figure 9 shows Qwen3-8B
   offering an unprompted 10% discount and settling at 20% with 15% upfront, both
   rules broken, under nothing more than mild pushback. Models fail these rules
   under conversational pressure, not from ignorance. Anything that must hold is
   validated in code. **[paper — finding ②, Figure 9]**

3. **Validate offers before they are returned, not after.** A generated offer that
   fails policy validation is rejected and regenerated. It never reaches the API
   response. **[eng]**

4. **Strategy selection is explicit and logged.** Every turn carries a strategy
   label from a closed set. An unlabelled turn is a bug. **[paper]**

5. **Optimise the pair, never the single metric.** Interaction experience alone
   produces over-conceding agents; collection rate alone produces coercive ones.
   Both failure modes are reproducible and must be regression-tested.
   **[paper — finding ②]**

6. **The debtor simulator is test infrastructure.** It scores the collector. It is
   never exposed to a real counterparty and never reachable from a production
   route. **[eng]**

7. **Full turn audit.** Persist state, model and prompt versions, retrieved
   context references, selected strategy, validation outcomes, and final utterance.
   Collections is regulated; the transcript is the evidence. **[eng]**

---

## 3. Domain model

Pydantic v2 models in `domain/`. Shared vocabulary for the whole system.

### 3.1 Agreement — the terminal state **[paper — Appendix A.2]**

Success requires all four fields specified and in range.

| Field | Meaning | Allowable values | Policy default |
|---|---|---|---|
| `disc_ratio` | discount on principal | 0, 5, 10, 15, 20, 25, 30 (%) | 0 — only on evidenced hardship |
| `pmt_ratio` | upfront share | 5–50 in steps of 5 (%) | target ≥ 25 |
| `pmt_days` | days to pay upfront | 1–14 | target ≤ 7 |
| `inst_prds` | months for remainder | 3, 6, 9, 12, 18, 24 | prefer 3 or 6 |

Enum-constrained. Reject off-grid values — no rounding, no coercion.

### 3.2 Persona — the counterparty model **[paper — §3.1, Appendix B.1]**

`Persona = (Background, Personality, Cognition, Scenario)`

- **Background** — age, gender, overdue amount, days overdue, overdue reason,
  daily income, current assets.
- **Personality** — character traits, MBTI type, six-emotion vector
  (happiness / sadness / disgust / fear / surprise / anger, each 0–10), emotional
  resilience (5 levels), linguistic style.
- **Cognition** — legal awareness, financial literacy, responsibility, credit
  awareness; each 1–5 with a second-person description.
- **Scenario** — a life narrative unifying the above.

Simulator note: models default to being rational and financially literate.
Low-cognition personas require active suppression of that default, not prompt
flavour. **[paper — Appendix B.1]**

Behavioural archetypes and observed distribution: **Confrontational 38%, Avoidant
31%, Helpless 25%, Cooperative 6%.** Confrontational is the largest *and* hardest
segment — primary optimisation target, not an edge case. **[paper — Table 3]**

### 3.3 Strategy sets **[paper — Tables 7 & 8]**

Collector (9): `IDENTITY_VERIFICATION`, `ESTABLISH_TRUST`, `FINANCIAL_ASSESSMENT`,
`EMOTIONAL_APPEASEMENT`, `STATEMENT_OF_FACTS`, `CONSTRUCTIVE_CHALLENGE`,
`ETHICAL_APPEAL`, `LEGAL_DETERRENT`, `REPAYMENT_NEGOTIATION`

Debtor, simulator only (8): `HONEST_DISCLOSURE`, `VAGUE_RESPONSE`,
`FALSE_COMPLIANCE`, `SHIFT_RESPONSIBILITY`, `DILEMMA_RENDERING`,
`EMOTIONAL_CONFRONTATION`, `COMPLAINT`, `REPAYMENT_NEGOTIATION`

### 3.4 Turn and Trajectory

A turn carries `thoughts`, `strategy`, `action` (`ask` | `accept` | `non`),
`dialogue`, and the proposed agreement delta if any. A trajectory is the ordered
turns plus terminal agreement and outcome. **[paper — Figure 17]**

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  API layer (FastAPI)                                        │
│  session lifecycle · POST /turn · handoff · audit read      │
├─────────────────────────────────────────────────────────────┤
│  Guardrail layer          (pre- and post-generation)        │
│  compliance rules · prohibited content · PII · escalation   │
├─────────────────────────────────────────────────────────────┤
│  Negotiation orchestrator                                   │
│  state assembly · context retrieval · generation · validate │
├─────────────────────────────────────────────────────────────┤
│  Policy engine (pure, deterministic, no LLM)                │
│  offer envelope · validation · concession ladder            │
├─────────────────────────────────────────────────────────────┤
│  Retrieval (§7)          │  Model gateway (§9)              │
└─────────────────────────────────────────────────────────────┘

Offline only, never routed:
  Debtor simulator · Persona factory · Evaluation harness
```

### Repository layout

```
src/
  api/              routes, request/response schemas
  domain/           Agreement, Persona, Turn, Trajectory
  policy/           deterministic rules; pure functions, no I/O
  guardrails/       compliance checks, escalation triggers
  retrieval/        jurisdiction packs, playbooks, objection library
  agent/
    collector.py    strategy selection + utterance generation
    prompts/        versioned prompt templates
  gateway/          OpenAI client, role routing, retries, budget
  persistence/      repositories, audit log
eval/
  simulator/        debtor agent (offline only)
  personas/         persona factory + seeded fixtures
  metrics/          the nine metrics
  suites/           regression suites per archetype
```

---

## 5. The turn loop

One path. Single generation per turn.

1. **Assemble state** — history, account facts, current offer envelope from the
   policy engine, inferred archetype.
2. **Retrieve context** — jurisdiction compliance pack and any applicable client
   playbook (§7). Retrieval failure is a hard stop, not a soft degrade.
3. **Generate** one strategy-labelled turn.
4. **Policy validation** — deterministic. Any proposed agreement outside the
   envelope is rejected.
5. **Guardrails** — post-generation compliance and content checks.
6. On failure at 4 or 5, regenerate with the violation fed back. Max 2 retries,
   then escalate to human rather than returning a non-compliant turn.
7. **Persist** the full audit record.

### Deferred: best-of-N with judge reranking **[scope]**

The paper's coarse-grained filtering — sample `N` candidates, score them listwise
on Respect & Empathy / Transparency / Feasibility, run the comparison **twice in
forward and reverse order** and sum `S_k = s_fwd_k + s_rev_k` to cancel position
bias, keep the top candidate — is a quality dial, not a correctness requirement.
**[paper — §4.1, eq. 2]**

It costs roughly `N + 2` calls per turn instead of 1. Build it only if phase 3
metrics show single-generation quality falling short, and keep it behind config so
it can be enabled per-account rather than globally. If it is built, the
bidirectional scoring is mandatory — single-direction listwise scoring is
measurably biased and worse than not reranking at all.

---

## 6. Policy and guardrails

### Concession discipline **[paper — Figure 17]**

- Hold discounts at 0% unless the persona evidences genuine or extreme hardship.
- Push for ≥25% upfront; flex only against demonstrated liquidity constraints.
- Target payment within 7 days; extend to 14 only on credible cash-flow evidence.
- Prefer 3 or 6 month installments; longer terms need justification.

These live in **both** the prompt (as guidance) and the policy engine (as
enforcement). Per law 2, the prompt copy is not sufficient on its own.

Mandatory regression test: a debtor applying mild pushback twice must not extract
two concessions. This is the exact documented failure. **[paper — Figure 9]**

### Compliance guardrails **[eng]**

Jurisdiction-specific — the paper's rules come from one fintech in one legal
setting and do not generalise. **[paper — Limitations]** Rule *content* is
retrieved (§7); rule *evaluation* is code.

- No threats of legal action the institution cannot or will not take.
- No contact-time or contact-frequency violations.
- No third-party disclosure of the debt.
- No misrepresentation of consequences.
- Identity and purpose disclosed on turn one.

### Escalation to human **[eng]**

Hard handoff — agent stops and returns an escalation response — on: dispute of the
debt's validity, request for written validation, mention of bankruptcy or legal
representation, distress or self-harm signals, repeated complaint escalation,
retry exhaustion, or any guardrail breach.

---

## 7. Knowledge sources — what goes where

Three places knowledge can live. Putting a thing in the wrong one is a design
error, most often by using a prompt or a retrieval hit where a code assertion
belongs.

| Layer | Holds | Why here |
|---|---|---|
| **Code** (`policy/`, `guardrails/`) | Agreement value grids, concession thresholds, validation logic, metric arithmetic, escalation triggers | Must hold under adversarial pressure. Cannot be argued out of a check. Testable, versioned, auditable. |
| **Prompt** (`agent/prompts/`) | The 9 strategies, output format, persona injection, tone, concession discipline as guidance | Small, stable, needed on every call. Retrieval here adds failure modes for no benefit. |
| **Retrieval** (`retrieval/`) | Jurisdiction compliance packs, client collections playbooks, loan product terms, objection-handling library | Large, varies per tenant, changes without our involvement. Genuinely unsuited to either of the above. |

### Retrieval rules **[eng]**

- **Never source a policy value from retrieval.** Discount tiers and upfront
  thresholds come from code. Retrieved documents may explain rules; they never
  define enforceable limits.
- **Retrieved content is reference material, not instruction.** A playbook is data.
  Text inside a retrieved document that reads like a directive does not acquire
  authority by being retrieved.
- **Fail closed.** If the jurisdiction compliance pack cannot be retrieved, the
  turn does not proceed. Escalate. Never negotiate without knowing the rules of
  the jurisdiction.
- **Cite in the audit record.** Every turn logs which chunks were in context.
  "Which playbook version produced this offer" must be answerable.
- Retrieval is scoped per tenant and per jurisdiction. Cross-tenant leakage of a
  client playbook is a serious incident.

---

## 8. Evaluation harness

Build this **before** the agent. The metrics are the product spec. This is the
test suite, not an agent component — the judge and simulator here never touch a
production route. **[paper — Appendix C.3]**

**Negotiation ability**
- `SR` — share reaching a valid agreement within `T_max`.
- `AT` — mean turns across all dialogues, successful or not. Lower is better.
- `CR` — `mean over all N of (1 − disc_ratio) × success_indicator`.
- `CE` — over successful dialogues: `(1 − dr) × ( pr/pd + (1 − pr)/(ip × 30) )`

**Agreement rationality**
- `SA` — `w_short × (assets + daily_income × pmt_days) / (debt × (1 − dr) × pr)`,
  `w_short = 0.85`; reported as share of successful dialogues with `SA_i ≥ 1.0`.
- `LS` — `w_long × daily_income × 30 × inst_prds / (debt × (1 − dr) × (1 − pr))`,
  `w_long = 0.95`; same thresholding.

**Interaction experience** — LLM judge, 1–10, conditioned on the full transcript
*and* the persona: `US`, `ES`, `CA`.

**Harness requirements [eng]**
- Report all nine metrics **sliced by archetype**, never aggregate only. Aggregate
  scores hide the confrontational-segment collapse that is the point of this
  benchmark.
- Validate the judge against human ratings before trusting it.
- Fixed, seeded, version-controlled persona test set. Metrics across a changing
  set are meaningless.
- Running a dialogue to completion against the simulator *is* the test. Six of the
  nine metrics do not exist without it.

---

## 9. Model roles

Four named roles behind the gateway, each independently configurable. Only one is
reachable in production.

| Role | Purpose | Production? |
|---|---|---|
| `COLLECTOR` | The product. Strongest available chat model, low but non-zero temperature. | Yes |
| `JUDGE` | US/ES/CA scoring in the harness. Different model from `COLLECTOR` to reduce self-preference bias. `temperature=0`. | No — eval only |
| `SIMULATOR` | Debtor agent. Must be able to play low-cognition personas convincingly. | No — eval only |
| `SYNTHESIS` | Persona generation. Offline batch. | No — offline |

Prompts are versioned files in `agent/prompts/`. Every audit record stores the
prompt version and model identifier that produced it. **[eng]**

Determinism caveat: closed-source APIs may vary even at `temperature=0`.
**[paper — Appendix C.2]** Do not write tests asserting byte-identical output;
assert on structure, policy compliance, and metric bands.

---

## 10. Known limitations of this build

Documented deliberately. When someone asks why we diverge from the paper, this is
the answer.

| Paper capability | Our position |
|---|---|
| CFPO / DPO fine-tune (DebtGPT) | **Not built.** Foresight is elicited by prompt, not learned. **[scope]** |
| Best-of-N + live judge reranking | **Deferred.** Quality dial; enable per §5 if metrics justify. |
| Per-candidate forward simulation in the live loop | **Not built.** Retained in the harness. |
| Personas grounded in 1,000 real transcripts | **Not available.** Our personas are LLM-generated with no real corpus to distill from — a genuine fidelity gap. If client transcripts can be obtained under DPA, this is the highest-value input to the system. |
| Dialogue Realism evaluation (synthetic vs. real, side by side) | **Cannot run** without real reference dialogues. Persona Consistency evaluation still works. |
| Ablation studies (w/o Filter, w/o Simulation) | **Not reproducible** without the training pipeline. |
| Model ownership / on-prem inference | **Not available.** Debtor PII transits a third-party API — see §11. |
| Reproducible deterministic runs | **Degraded.** See §9. |

None of these block a working, evaluable negotiator. The persona-grounding gap is
the one worth revisiting first.

---

## 11. Data and privacy

- Real collector–debtor transcripts are the highest-sensitivity data class here.
  Not used as prompt fixtures, not committed, not sent to any third-party API
  without an executed DPA and a zero-retention endpoint.
- Development and test personas are synthetic. Anonymise names, synthesize
  financial attributes, generalise delinquency reasons to categories.
  **[paper — Ethical Considerations]**
- The upstream dataset is released research-only, prohibiting operational use.
  Anything pulled from that repository stays in `eval/` and never ships. Confirm
  licence terms before taking a dependency. **[paper]**
- Audit logs and the retrieval index contain PII and commercial terms — encrypt at
  rest, restrict read access, define retention before the hardening phase.

---

## 12. Stack and standards

- Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.x, Postgres, Redis.
- `uv` for dependencies. `ruff` for lint and format. `mypy --strict` on `domain/`
  and `policy/`.
- `policy/` is pure: no I/O, no LLM calls, no clock reads. Exhaustively unit- and
  property-testable (hypothesis).
- No prompts as inline string literals.
- No secrets in code. No live credentials in tests.
- Every LLM call goes through the gateway. No direct SDK use elsewhere.

---

## 13. Build phases

Do not start a phase before the previous one's exit criteria are met.

**Phase 1 — Domain and policy.** Models, enum-constrained agreement, deterministic
policy engine, concession ladder. No LLM anywhere.
*Exit:* property tests prove no invalid agreement can be constructed or approved.

**Phase 2 — Evaluation harness and simulator.** Persona factory across all four
archetypes, debtor simulator, all nine metrics, seeded test set, archetype slicing.
*Exit:* a deliberately naive baseline agent runs end-to-end and produces a full
scored report.

**Phase 3 — Negotiator API.** Single-path turn loop, strategy-labelled generation,
policy validation, guardrails, retry-and-escalate, audit persistence, FastAPI
surface.
*Exit:* beats the naive baseline on CR without regressing US/ES; passes the
double-concession regression test; confrontational-slice metrics reported.

**Phase 4 — Retrieval.** Jurisdiction packs, client playbooks, objection library,
per-tenant scoping, fail-closed behaviour, audit citation.
*Exit:* a jurisdiction swap changes agent behaviour with no code change; missing
pack escalates rather than proceeds.

**Phase 5 — Hardening.** Human review queue, observability, cost controls, latency
budget, rate limiting, DR.

---

## 14. Working agreements

- Small, reviewable increments. Show the plan before writing a phase's worth of code.
- When the paper is ambiguous, say so and propose an interpretation rather than
  silently inventing one.
- Flag anything that would breach §2 rather than working around it.
- Do not add capability not in this file or explicitly requested.
