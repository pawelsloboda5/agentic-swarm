# research-swarm — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 15%, patterns 25%

```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Research 42 distinct subtopics in the history of distributed consensus algorithms and synthesize a cited report.',
  phases: [
    { title: 'Plan subtopics' },
    { title: 'Research subtopics' },
    { title: 'Synthesize report' },
  ],
}

phase('Plan subtopics')

const subtopics = [
  'Early foundations of consensus in fault-tolerant distributed systems',
  'FLP impossibility result and its historical significance',
  'Byzantine fault tolerance origins',
  'Oral Messages and authenticated Byzantine agreement',
  'Dolev-Strong protocol',
  'Viewstamped Replication',
  'Paxos: genesis and theoretical framing',
  'Paxos variants and production adoption',
  'Raft: motivation and design goals',
  'Paxos versus Raft in historical context',
  'State machine replication as a consensus architecture',
  'Atomic broadcast and consensus equivalence',
  'Two-phase commit versus consensus',
  'Three-phase commit and failure assumptions',
  'Quorum systems and majority voting',
  'Leader election in consensus systems',
  'Crash fault tolerance versus Byzantine fault tolerance',
  'Lamport’s contributions to consensus thinking',
  'Leslie Lamport, Nancy Lynch, and consensus theory',
  'Schneider and replicated state machines',
  'Practical Byzantine Fault Tolerance (PBFT)',
  'PBFT lineage and influence',
  'Zab in ZooKeeper',
  'Chain replication and related coordination patterns',
  'Consensus in distributed databases',
  'Consensus in cloud infrastructure control planes',
  'Consensus in blockchain: Nakamoto consensus',
  'Proof-of-work and consensus history',
  'Proof-of-stake and alternative blockchain consensus',
  'BFT in blockchains and permissioned ledgers',
  'Gossip-based consensus approaches',
  'Federated Byzantine agreement and Stellar',
  'Crash-consensus in industry: Chubby, ZooKeeper, etcd, Consul',
  'Consensus under partial synchrony',
  'Timing assumptions and failure detectors',
  'Randomization in consensus algorithms',
  'Consensus in sensor networks and edge systems',
  'Hardware support and consensus acceleration',
  'Formal verification of consensus protocols',
  'Teaching, exposition, and standardization of consensus',
  'The impact of consensus on modern distributed systems',
  'Open research problems shaped by historical consensus work',
]

phase('Research subtopics')

const research = await parallel(subtopics.map((subtopic, index) => async () => {
  const prompt = `
You are a research subagent in a distributed-systems history swarm.

Research the subtopic: "${subtopic}"

Return ONLY valid JSON matching this schema:
{
  "name": string,
  "keyPoints": [string, string, string],
  "sources": [string, string, string]
}

Requirements:
- "name" should be a concise, human-readable title for the subtopic.
- "keyPoints" must contain exactly 3 distinct, concise factual bullets focused on historical significance, key ideas, or milestones.
- "sources" must contain 1 to 3 source URLs (prefer authoritative sources such as academic papers, conference papers, university notes, project docs, or reputable historical overviews).
- Use canonical URLs when possible.
- Do not include markdown, extra commentary, or trailing text.
- If fewer than 3 high-quality URLs are available, include fewer than 3.
`;
  return agent(prompt, {
    phase: 'Research subtopics',
    label: `${index + 1}. ${subtopic}`,
    effort: 'medium',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'keyPoints', 'sources'],
      properties: {
        name: { type: 'string' },
        keyPoints: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: { type: 'string' },
        },
        sources: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: { type: 'string' },
        },
      },
    },
  })
}))

const validResearch = research.filter(Boolean)

phase('Synthesize report')

const report = await agent(`
You are an expert historian of distributed systems.

Using the structured findings below, write one synthesized, cited report on "the history of distributed consensus algorithms" that covers all 42 subtopics.

Goals:
- Produce a cohesive narrative, not a list of disconnected notes.
- Cover all subtopics explicitly and meaningfully.
- Cite claims inline using bracketed numeric citations like [1], [2], etc.
- Build a reference list at the end mapping each citation number to the relevant source URLs.
- Prefer the provided sources; do not invent citations or URLs.
- If multiple findings support the same claim, cite multiple numbers.
- Include an introduction, thematic sections, and a conclusion.
- Keep the tone analytical and historically grounded.

Input findings as JSON:
${JSON.stringify(validResearch, null, 2)}
`, {
  phase: 'Synthesize report',
  label: 'Synthesis',
  effort: 'high',
})

report
```

> **GPT-5.5 judge:** The script uses one giant unbounded parallel() over all 42 subagents, creating a single hard barrier where one hung connection can deadlock the entire research phase with no watchdog or notification. It has no bounded waves, no per-agent retry/timeout handling, no per-wave commits, no ScheduleWakeup stall watchdog, no resume/cache-stable prompts, no failure-rate backoff, and synthesis does not explicitly tolerate partial input or flag gaps. It does use lean capped JSON schemas for subagent outputs and filters falsy research results, but that filter only helps after the full parallel call returns and does not protect against hangs or rejection. Overall it meets only a small fraction of the safety-by-construction bar.

## With skill — rubric 65%, patterns 75%

```js
export const meta = {
  name: 'consensus-history-research-swarm',
  description: 'Research 42 subtopics on the history of distributed consensus algorithms and synthesize a cited report.',
  phases: [
    { title: 'Plan' },
    { title: 'Research Waves' },
    { title: 'Retry Missing' },
    { title: 'Synthesize' },
  ],
}

const SUBTOPICS = [
  { key: 'byzantine-ancestors', name: 'Pre-Byzantine fault tolerance antecedents' },
  { key: 'synchrony-models', name: 'System model assumptions: synchrony, asynchrony, partial synchrony' },
  { key: 'two-phase-commit', name: 'Two-phase commit and early transaction commit protocols' },
  { key: 'three-phase-commit', name: 'Three-phase commit and non-blocking commit ideas' },
  { key: 'reliable-broadcast', name: 'Reliable broadcast and atomic broadcast foundations' },
  { key: 'paxos-prehistory', name: 'Pre-Paxos replication and state machine replication ideas' },
  { key: 'viewstamped-replication', name: 'Viewstamped Replication and related early SMR work' },
  { key: 'lamport-paxos', name: 'Lamport’s Paxos and the consensus breakthrough' },
  { key: 'paxos-made-simple', name: 'Paxos exposition and adoption path' },
  { key: 'multi-paxos', name: 'Multi-Paxos and leader optimization' },
  { key: 'fast-paxos', name: 'Fast Paxos and quorum-tradeoff evolution' },
  { key: 'generalized-paxos', name: 'Generalized Paxos and commutativity' },
  { key: 'epaxos', name: 'EPaxos and leaderless replication' },
  { key: 'raft', name: 'Raft: understandable consensus and its impact' },
  { key: 'log-structured-replication', name: 'Log replication as a dominant consensus pattern' },
  { key: 'zab', name: 'Zab and ZooKeeper’s atomic broadcast' },
  { key: 'totem', name: 'Token-ring and ordered multicast systems like Totem' },
  { key: 'pbft', name: 'PBFT and practical Byzantine fault tolerance' },
  { key: 'spinning-off-byzantine', name: 'Byzantine consensus after PBFT' },
  { key: 'steward', name: 'Steward and proactive recovery approaches' },
  { key: 'hotstuff', name: 'HotStuff and linear communication Byzantine consensus' },
  { key: 'tendermint', name: 'Tendermint and blockchain BFT consensus' },
  { key: 'honeybadgerbft', name: 'HoneyBadgerBFT and asynchronous Byzantine consensus' },
  { key: 'algorand', name: 'Algorand and cryptographic sortition' },
  { key: 'bitcoin-nakamoto', name: 'Nakamoto consensus and longest-chain security' },
  { key: 'proof-of-stake', name: 'Proof-of-stake consensus history' },
  { key: 'dpos', name: 'Delegated proof-of-stake and governance tradeoffs' },
  { key: 'consensus-in-cloud-systems', name: 'Consensus in cloud and datacenter storage systems' },
  { key: 'google-spanner', name: 'Spanner, TrueTime, and consensus at Google scale' },
  { key: 'etcd-consul', name: 'etcd/Consul and operational Raft in practice' },
  { key: 'mongo-replica-set', name: 'Replica sets and consensus-like leader election in databases' },
  { key: 'cassandra-dynamo', name: 'Dynamo-style systems and the absence of strong consensus' },
  { key: 'curp', name: 'CURP and fast replicated state machines' },
  { key: 'flexible-quorums', name: 'Flexible quorums and quorum system generalizations' },
  { key: 'reconfig-consensus', name: 'Reconfiguration and membership change' },
  { key: 'vertical-paxos', name: 'Vertical Paxos and reconfiguration theory' },
  { key: 'joint-consensus', name: 'Raft joint consensus and live reconfiguration' },
  { key: 'failure-detectors', name: 'Failure detectors and impossibility results' },
  { key: 'fischer-lynch-paterson', name: 'FLP impossibility and its consequences' },
  { key: 'byzantine-impossibility', name: 'Byzantine impossibility bounds and resilience limits' },
  { key: 'modern-blockchain-bft', name: 'Modern blockchain BFT protocols and lineage' },
  { key: 'survey-and-teaching', name: 'Surveys, textbooks, and teaching the history of consensus' },
]

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    key: { type: 'string' },
    name: { type: 'string' },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'string' },
    },
    sourceUrls: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'string' },
    },
  },
  required: ['key', 'name', 'keyPoints', 'sourceUrls'],
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    reportMarkdown: { type: 'string' },
    gaps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'reportMarkdown', 'gaps'],
}

const WAVE_SIZE = 7

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function buildPrompt(topic) {
  return [
    `Research ONE subtopic in the history of distributed consensus algorithms.`,
    `Subtopic key: ${topic.key}`,
    `Subtopic name: ${topic.name}`,
    ``,
    `Return a concise structured finding with exactly:`,
    `- key: the provided key`,
    `- name: the provided subtopic name`,
    `- keyPoints: exactly 3 key historical/technical points`,
    `- sourceUrls: 1 to 3 authoritative source URLs`,
    ``,
    `Guidelines:`,
    `- Focus on history, milestones, and influence on later consensus work.`,
    `- Prefer primary sources, seminal papers, authoritative docs, or well-known surveys.`,
    `- Keep each key point short and factual.`,
    `- Do not include long quotations.`,
    `- Do not invent citations; if uncertain, pick fewer but higher-quality URLs.`,
    `- The output must validate against the schema.`,
  ].join('\n')
}

function buildSynthesisPrompt(done, missing) {
  const ordered = [...done].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return [
    `Synthesize a cited report on the history of distributed consensus algorithms.`,
    `You must cover all subtopics represented in the provided findings and explicitly note gaps.`,
    `Total findings provided: ${ordered.length}.`,
    `Missing subtopics not yet researched: ${missing.length ? missing.join(', ') : 'none'}.`,
    ``,
    `Use the findings below as the evidence base. Preserve factual accuracy and cite by URL where relevant.`,
    `Write a cohesive report in Markdown with sections such as:`,
    `1. Early foundations`,
    `2. Paxos and lineage`,
    `3. Byzantine consensus`,
    `4. Blockchain-era consensus`,
    `5. Cloud/datacenter practice`,
    `6. Reconfiguration and quorums`,
    `7. Key historical takeaways`,
    `8. Gaps / thin evidence`,
    ``,
    `Requirements:`,
    `- Cover every subtopic represented in the findings.`,
    `- Explicitly mention any missing subtopics in a "Gaps / thin evidence" section.`,
    `- Include citations inline using the supplied source URLs.`,
    `- Do not fabricate citations not present in the findings.`,
    `- The report should be readable and substantive, not just a bullet dump.`,
    `- If sources conflict or evidence is thin, say so.`,
    ``,
    `Findings JSON:`,
    JSON.stringify(ordered),
  ].join('\n')
}

const waves = chunk(SUBTOPICS, WAVE_SIZE)
const done = []
let failed = []

phase('Research Waves')

for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  log(`Wave ${w + 1}/${waves.length}: researching ${wave.length} subtopics`)

  const batch = await parallel(
    wave.map(topic => () =>
      agent(buildPrompt(topic), {
        label: `research:${topic.key}`,
        phase: 'Research Waves',
        schema: RESULT_SCHEMA,
        model: 'claude-3.5-sonnet',
        effort: 'high',
      }),
    ),
  )

  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(wave[i])
  })

  const nulls = batch.filter(r => r === null).length
  log(`Wave ${w + 1} complete: ${done.length}/${SUBTOPICS.length} findings so far; ${failed.length} queued for retry`)
  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; returning partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry Missing')
  log(`Retrying ${failed.length} missing subtopics`)

  const retried = await parallel(
    failed.map(topic => () =>
      agent(buildPrompt(topic), {
        label: `retry:${topic.key}`,
        phase: 'Retry Missing',
        schema: RESULT_SCHEMA,
        model: 'claude-3.5-sonnet',
        effort: 'high',
      }),
    ),
  )

  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

const haveKeys = new Set(done.map(r => r.key))
const missing = SUBTOPICS.filter(t => !haveKeys.has(t.key)).map(t => t.key)

if (missing.length) {
  log(`⚠ partial: missing ${missing.length}/${SUBTOPICS.length}: ${missing.join(', ')}`)
}

phase('Synthesize')

const synthesis = await agent(buildSynthesisPrompt(done, missing), {
  label: 'synthesize-report',
  phase: 'Synthesize',
  schema: SYNTHESIS_SCHEMA,
  model: 'claude-3.5-sonnet',
  effort: 'xhigh',
})

return {
  results: done,
  missing,
  synthesis,
}
```

> **GPT-5.5 judge:** The script meets several safety criteria: it uses bounded waves of 7 instead of one giant fan-out, tolerates null agent results, retries missing subtopics, keeps outputs capped with schemas, synthesizes from partial input while explicitly reporting gaps, and backs off when a wave has a high failure rate. However, it lacks the most important protection against a hung connection: there is no armed ScheduleWakeup/stall watchdog or per-agent timeout, so one hung agent inside a wave can still block the whole run indefinitely with no notification. It also only accumulates results in memory rather than durably committing per wave, so completed work could be lost on process failure and resume/cache behavior is not really implemented. Overall it is moderately safe but not fully safe-by-construction for large parallel fan-out.

