# research-swarm — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 18%, patterns 25%

```js
export const meta = {
  name: 'research-swarm-distributed-consensus-history',
  description: 'Research 42 distinct subtopics in the history of distributed consensus algorithms and synthesize a cited report.',
  phases: [
    { title: 'Plan subtopics' },
    { title: 'Parallel research swarm' },
    { title: 'Synthesize report' },
  ],
}

const subtopics = [
  'Early fault-tolerant agreement foundations before Paxos',
  'Byzantine generals problem and formal impossibility framing',
  'FLP impossibility and its impact on consensus design',
  'Paxos: original formulation and historical significance',
  "Lamport's educational / explanatory Paxos variants",
  'Multi-Paxos and leader-based optimizations',
  'Raft: motivation, design goals, and adoption',
  'Viewstamped Replication and parallel lines of development',
  'Garcia-Molina/Towan-style distributed commit precursors',
  'Two-phase commit versus consensus',
  'Three-phase commit and atomic commit evolution',
  'Quorum systems and their role in consensus history',
  'State machine replication as the systems framing for consensus',
  'Primary-backup replication as a practical precursor',
  'Byzantine Fault Tolerance in the Castro-Liskov era',
  'Practical Byzantine Fault Tolerance (PBFT)',
  'Quorum intersection theory in crash-fault consensus',
  'Work on consensus under partial synchrony',
  'Failure detectors and Chandra-Toueg influence',
  'Randomized consensus algorithms',
  'Ben-Or and early probabilistic agreement',
  'Dolev-Strong and authenticated Byzantine agreement',
  'Terminated consensus in synchronous systems',
  'Consensus in shared-memory models',
  'Compare-and-swap and universal constructions',
  'Leader election as a building block for consensus',
  'Gossip protocols and epidemic dissemination as enabling infrastructure',
  'Consensus in database replication systems',
  'Zab and ZooKeeper’s contribution',
  'Chain replication and its relationship to consensus',
  'EPaxos and generalized consensus',
  'Fast Paxos and low-latency consensus',
  'Cheap Paxos and fault-model cost tradeoffs',
  'Vertical Paxos and dynamic reconfiguration',
  'Reconfigurable consensus and membership changes',
  'Blockchain era consensus: Nakamoto consensus',
  'Proof-of-work versus classical consensus',
  'Proof-of-stake consensus lineage',
  'BFT blockchain protocols',
  'Consensus in geo-replicated storage systems',
  'Industrial adoption and open-source implementations',
  'Open research problems and modern directions',
]

phase('Plan subtopics')
log(`Preparing ${subtopics.length} distinct subtopics for the research swarm.`)

const researchPrompt = (subtopic) => `
You are one specialist researcher in distributed systems history.

Research the subtopic: "${subtopic}"

Return ONLY valid JSON matching this schema:
{
  "name": string,
  "key_points": [string, string, string],
  "source_urls": [string]
}

Requirements:
- "name" should be a concise title for the subtopic.
- "key_points" must contain exactly 3 concise but substantive bullets.
- "source_urls" must contain 1 to 3 reputable URLs directly relevant to the subtopic.
- Favor primary sources, canonical papers, or authoritative historical summaries.
- Include historical context, significance, and a concrete technical detail.
- No markdown, no extra commentary, only JSON.
`

phase('Parallel research swarm')
const findings = await parallel(
  subtopics.map((subtopic, index) => async () =>
    agent(researchPrompt(subtopic), {
      label: `R${String(index + 1).padStart(2, '0')}`,
      phase: 'Parallel research swarm',
      effort: 'high',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'key_points', 'source_urls'],
        properties: {
          name: { type: 'string' },
          key_points: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string' },
          },
          source_urls: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
    })
  )
)

const validFindings = findings.filter(Boolean)

phase('Synthesize report')
const synthesisPrompt = `
You are synthesizing a research swarm on the history of distributed consensus algorithms.

Use ONLY the structured findings below as evidence. Produce a cohesive, cited report that covers all 42 subtopics.
If some findings are missing, note the gaps briefly but still synthesize the rest.

Output format:
1. Title
2. Executive summary
3. Chronological narrative of the field
4. Theme-based sections that cover all subtopics
5. Brief "What changed over time" conclusion
6. References section listing source URLs grouped or deduplicated

Citation rules:
- Cite inline with bracketed reference numbers like [1], [2].
- Assign reference numbers consistently from the source URLs provided in the findings.
- Do not invent sources not present below.
- Prefer direct citations close to claims.

Structured findings JSON:
${JSON.stringify(validFindings, null, 2)}
`

const report = await agent(synthesisPrompt, {
  label: 'Synthesis',
  phase: 'Synthesize report',
  effort: 'xhigh',
})

log('Research swarm complete.')
report
```

> **Claude judge:** The entire 42-agent fan-out is a single unbounded parallel() barrier with no wave batching, no per-agent retry, no stall watchdog, and no intermediate result commits — meaning one hung agent can stall the whole run and any failures are silently dropped after a single filter(Boolean). Only deterministic prompts, lean schemas, and a soft gap-flagging instruction in the synthesis prompt provide any safety.

## With skill — rubric 78%, patterns 75%

```js
export const meta = {
  name: 'research-swarm-distributed-consensus-history',
  description: 'Research 42 subtopics in the history of distributed consensus algorithms and synthesize a cited report.',
  phases: [{ title: 'Plan' }, { title: 'Research' }, { title: 'Synthesize' }],
}

const TOPIC = 'the history of distributed consensus algorithms'
const WAVE_SIZE = 7

const SUBTOPICS = [
  'Early fault-tolerant distributed systems and the problem definition',
  'Byzantine generals problem and impossibility framing',
  'Clock synchronization and ordering as prerequisites for consensus',
  'Two-phase commit and atomic commitment history',
  'Three-phase commit and non-blocking commit protocols',
  'Dijkstra self-stabilization and related early formal work',
  'Viewstamped replication origins',
  'Paxos origins and Leslie Lamport’s formalization',
  'Classic Paxos and Multi-Paxos evolution',
  'Fast Paxos',
  'Generalized Paxos',
  'Raft design goals and pedagogical impact',
  'Zab and ZooKeeper’s atomic broadcast lineage',
  'Virtual synchrony and group communication systems',
  'Primary-backup replication and consensus tradeoffs',
  'The role of failure detectors in consensus theory',
  'FLP impossibility result',
  'Randomized consensus in asynchronous systems',
  'Consensus under partial synchrony',
  'Leader election and its relationship to consensus',
  'State machine replication as a consensus application pattern',
  'Atomic broadcast and total order broadcast equivalence',
  'Consensus in distributed databases',
  'Consensus in distributed filesystems',
  'Chubby and production impact of Paxos-style systems',
  'Spanner and globally distributed coordination',
  'Dynamo-style systems and the contrasting AP design space',
  'EPaxos and leaderless consensus developments',
  'Tendermint and BFT consensus in blockchains',
  'HotStuff and modern BFT linearity',
  'Practical Byzantine Fault Tolerance (PBFT)',
  'HoneyBadgerBFT and asynchronous BFT',
  'Crash fault tolerant vs Byzantine fault tolerant consensus',
  'Quorum systems and intersection properties',
  'Quorum-based read/write protocols and their influence',
  'Consensus in replicated log architectures',
  'Consensus optimization via batching and pipelining',
  'Consensus under reconfiguration',
  'Geo-replication and WAN consensus challenges',
  'Formal verification of consensus protocols',
  'Educational controversies and the Paxos vs Raft debate',
  'Modern industrial/open-source consensus systems and lessons learned',
  'Open research directions in consensus history and practice',
]

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subtopic: { type: 'string' },
    name: { type: 'string' },
    key_points: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'string' },
    },
    source_urls: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: { type: 'string' },
    },
  },
  required: ['subtopic', 'name', 'key_points', 'source_urls'],
}

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    overview: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 42,
      maxItems: 42,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          subtopic: { type: 'string' },
          summary: { type: 'string' },
          citations: {
            type: 'array',
            minItems: 0,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
        required: ['subtopic', 'summary', 'citations'],
      },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'overview', 'sections', 'gaps'],
}

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function buildResearchPrompt(subtopic) {
  return [
    `Research the historical development of this subtopic in the broader history of distributed consensus algorithms: "${subtopic}".`,
    `Return a concise, structured finding with exactly:`,
    `- subtopic: the same subtopic string`,
    `- name: a short human-friendly label`,
    `- key_points: exactly 3 bullet-like sentences, each one concise`,
    `- source_urls: up to 3 authoritative URLs (papers, docs, or reputable references)`,
    `Keep outputs lean. Avoid long quotes. Prefer primary or near-primary sources when possible.`,
    `If evidence is thin, still provide the best-supported concise finding and keep source_urls short.`,
  ].join('\n')
}

phase('Plan')
log(`Planning 42 subtopics for research on ${TOPIC}`)

const waves = chunk(SUBTOPICS, WAVE_SIZE)
const done = []
let failed = []

function runSubtopic(subtopic) {
  return agent(buildResearchPrompt(subtopic), {
    label: `research:${subtopic}`,
    phase: 'Research',
    schema: ITEM_SCHEMA,
    effort: 'medium',
  })
}

for (let w = 0; w < waves.length; w++) {
  phase(`Research wave ${w + 1}/${waves.length}`)
  const wave = waves[w]
  const batch = await parallel(wave.map((subtopic) => () => runSubtopic(subtopic)))
  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(wave[i])
  })
  const nulls = batch.filter((r) => r === null).length
  log(`Wave ${w + 1}: ${done.length}/${SUBTOPICS.length} researched, ${failed.length} pending retry`)
  if (batch.length && nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  const retryBatch = await parallel(failed.map((subtopic) => () => runSubtopic(subtopic)))
  const stillFailed = []
  retryBatch.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retryBatch.filter(Boolean).length}; still missing ${failed.length}`)
}

const have = new Set(done.map((r) => r.subtopic))
const missing = SUBTOPICS.filter((subtopic) => !have.has(subtopic))
if (missing.length) log(`⚠ partial: missing ${missing.length}/${SUBTOPICS.length}: ${missing.join(', ')}`)

phase('Synthesize')

const sortedDone = [...done].sort((a, b) => {
  if (a.subtopic < b.subtopic) return -1
  if (a.subtopic > b.subtopic) return 1
  return 0
})

const synthPayload = JSON.stringify(sortedDone)
const synthMissing = JSON.stringify(missing)

const report = await agent(
  [
    `Write a synthesized, cited report on the history of distributed consensus algorithms based only on the research findings below.`,
    `You must cover all 42 subtopics, grouped into a coherent narrative with clear chronology and themes.`,
    `If some subtopics are missing, explicitly note those gaps in a "Gaps / thin evidence" section rather than omitting them.`,
    `Keep citations tied to the subtopic sections; use the provided source URLs as citations.`,
    `Research findings JSON:`,
    synthPayload,
    `Missing subtopics JSON:`,
    synthMissing,
  ].join('\n\n'),
  {
    label: 'synthesis-report',
    phase: 'Synthesize',
    schema: REPORT_SCHEMA,
    effort: 'high',
  }
)

return {
  topic: TOPIC,
  subtopics: SUBTOPICS,
  findings: done,
  missing,
  report,
}
```

> **Claude judge:** The script implements bounded waves (size 7), per-agent null-tolerance with a retry pass, per-wave result commitment, deterministic prompts, lean capped schemas, gap-flagging synthesis, and a 40% failure-rate backoff — covering 7 of 8 safety properties well. The only missing element is a ScheduleWakeup stall watchdog, meaning a single hung agent connection could silently deadlock an entire wave with no timeout or notification.

