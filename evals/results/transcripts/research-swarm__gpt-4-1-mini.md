# research-swarm — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 20%, patterns 25%

```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Research 42 distinct subtopics on the history of distributed consensus algorithms and synthesize a comprehensive cited report.',
  phases: [
    { title: 'Research Subtopics' },
    { title: 'Synthesize Report' },
  ],
}

const SUBTOPICS = [
  'Early concepts of consensus in distributed systems',
  'Leslie Lamport and the Paxos algorithm',
  'The Byzantine Generals Problem',
  'Practical Byzantine Fault Tolerance (PBFT)',
  'Raft consensus algorithm',
  'Two-phase commit protocol',
  'Three-phase commit protocol',
  'Viewstamped Replication',
  'Consensus in blockchain technology',
  'Proof of Work consensus',
  'Proof of Stake consensus',
  'Delegated Proof of Stake',
  'Federated Byzantine Agreement',
  'Consensus in distributed databases',
  'Consensus in distributed ledgers',
  'Consensus in sensor networks',
  'Consensus in peer-to-peer networks',
  'Consensus in cloud computing',
  'Consensus in multi-agent systems',
  'Consensus in fault-tolerant systems',
  'Consensus in real-time systems',
  'Consensus in mobile ad hoc networks',
  'Consensus in distributed file systems',
  'Consensus in distributed hash tables',
  'Consensus in replicated state machines',
  'Consensus in distributed transactions',
  'Consensus in distributed locking',
  'Consensus in distributed queues',
  'Consensus in distributed scheduling',
  'Consensus in distributed caching',
  'Consensus in distributed messaging systems',
  'Consensus in distributed control systems',
  'Consensus in distributed AI systems',
  'Consensus in distributed robotics',
  'Consensus in distributed sensor fusion',
  'Consensus in distributed optimization',
  'Consensus in distributed machine learning',
  'Consensus in distributed ledger technologies beyond blockchain',
  'Consensus algorithm performance and scalability',
  'Security challenges in consensus algorithms',
  'Future directions in distributed consensus research',
]

const researchSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Subtopic name/title' },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
      description: 'Three key points about the subtopic',
    },
    sourceUrls: {
      type: 'array',
      items: { type: 'string', format: 'uri' },
      maxItems: 3,
      description: 'Up to three source URLs',
    },
  },
  required: ['name', 'keyPoints'],
  additionalProperties: false,
}

const synthesizeSchema = {
  type: 'object',
  properties: {
    synthesizedReport: { type: 'string', description: 'Comprehensive synthesized report covering all subtopics with citations' },
  },
  required: ['synthesizedReport'],
  additionalProperties: false,
}

phase('Research Subtopics')

const researchThunks = SUBTOPICS.map((subtopic) => async () => {
  const prompt = `You are an expert researcher on distributed consensus algorithms. Research the following subtopic in the history of distributed consensus algorithms:

"${subtopic}"

Provide a structured response with:
- The subtopic name/title
- Exactly 3 key points summarizing the most important historical facts or developments about this subtopic
- Up to 3 source URLs (links to papers, articles, or authoritative resources) that support your findings

Respond in JSON format matching this schema:
{
  "name": "string",
  "keyPoints": ["string", "string", "string"],
  "sourceUrls": ["string", "string", "string"]
}

If fewer than 3 URLs are available, provide as many as you can.`;

  const result = await agent(prompt, { schema: researchSchema, label: `Research: ${subtopic}`, phase: 'Research Subtopics', effort: 'high' })
  return result
})

const researchResults = await parallel(researchThunks)

// Filter out any null results (failed/skipped agents)
const validResearchResults = researchResults.filter(r => r !== null)

phase('Synthesize Report')

const synthesisPrompt = `You are an expert technical writer tasked with synthesizing a comprehensive, well-structured report on the history of distributed consensus algorithms.

You have research findings on 42 distinct subtopics. Each subtopic includes:
- A name/title
- Three key historical points
- Up to three source URLs

Your task:
- Write a cohesive, flowing report that covers all subtopics.
- Integrate the key points from each subtopic into thematic sections.
- Cite sources inline by numbering them [1], [2], etc., and provide a numbered reference list at the end.
- Ensure clarity, accuracy, and historical context.
- The report should be suitable for an expert audience interested in the evolution and milestones of distributed consensus algorithms.

Here are the research findings:

${validResearchResults.map((r, i) => {
  const urls = r.sourceUrls.length > 0 ? r.sourceUrls.map(u => `- ${u}`).join('\n') : '- No sources provided'
  return `Subtopic ${i + 1}: ${r.name}
Key Points:
1. ${r.keyPoints[0]}
2. ${r.keyPoints[1]}
3. ${r.keyPoints[2]}
Sources:
${urls}
`
}).join('\n')}

Please produce the synthesized report as a JSON object with this schema:
{
  "synthesizedReport": "string"
}
`

const synthesisResult = await agent(synthesisPrompt, { schema: synthesizeSchema, label: 'Synthesize Report', phase: 'Synthesize Report', effort: 'max' })

return synthesisResult.synthesizedReport
```

> **Claude judge:** The script fans out all 42 subtopics in a single `parallel()` call (no bounded waves of 6-8), has no per-agent retry logic (only a null filter), no ScheduleWakeup watchdog, no per-wave result commits, no backoff on high failure rates, and the synthesis prompt does not explicitly flag gaps in partial input. Positives include deterministic/cache-stable prompts, lean capped schemas (3 key points, 3 URLs), and basic null-tolerance filtering. Overall this is a minimal safety implementation missing most of the required safety-by-construction properties.

## With skill — rubric 92%, patterns 94%

```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Research 42 subtopics on the history of distributed consensus algorithms and synthesize a cited report',
  phases: [
    { title: 'Research Subtopics' },
    { title: 'Retry Failed' },
    { title: 'Synthesize Report' },
  ],
}

const WAVE_SIZE = 6

// 42 distinct subtopics of "the history of distributed consensus algorithms"
const SUBTOPICS = [
  { key: 'paxos', title: 'Paxos algorithm origins and evolution' },
  { key: 'raft', title: 'Raft consensus algorithm development' },
  { key: 'two-phase-commit', title: 'Two-phase commit protocol history' },
  { key: 'three-phase-commit', title: 'Three-phase commit protocol' },
  { key: 'byzantine-fault-tolerance', title: 'Byzantine fault tolerance algorithms' },
  { key: 'lamport-timestamps', title: 'Lamport timestamps and ordering' },
  { key: 'chandra-toueg', title: 'Chandra-Toueg consensus algorithm' },
  { key: 'viewstamped-replication', title: 'Viewstamped replication protocol' },
  { key: 'fischer-lynch-patterson', title: 'FLP impossibility result' },
  { key: 'virtual-synchronous', title: 'Virtual synchronous protocols' },
  { key: 'consensus-in-blockchains', title: 'Consensus in blockchain systems' },
  { key: 'proof-of-work', title: 'Proof-of-work consensus history' },
  { key: 'proof-of-stake', title: 'Proof-of-stake consensus overview' },
  { key: 'gossip-protocols', title: 'Gossip protocols for consensus' },
  { key: 'epaxos', title: 'EPaxos and its innovations' },
  { key: 'fast-paxos', title: 'Fast Paxos algorithm' },
  { key: 'multi-paxos', title: 'Multi-Paxos protocol' },
  { key: 'zookeeper-consensus', title: 'Zookeeper atomic broadcast' },
  { key: 'raft-vs-paxos', title: 'Comparison of Raft and Paxos' },
  { key: 'consensus-in-database-systems', title: 'Consensus in distributed databases' },
  { key: 'consensus-in-cloud-systems', title: 'Consensus in cloud infrastructure' },
  { key: 'consensus-in-messaging-systems', title: 'Consensus in messaging systems' },
  { key: 'consensus-in-filesystems', title: 'Consensus in distributed filesystems' },
  { key: 'consensus-in-microservices', title: 'Consensus in microservices architectures' },
  { key: 'consensus-in-iot', title: 'Consensus algorithms for IoT devices' },
  { key: 'consensus-in-edge-computing', title: 'Consensus in edge computing' },
  { key: 'consensus-in-ai-systems', title: 'Consensus in AI distributed systems' },
  { key: 'consensus-in-fintech', title: 'Consensus in financial technology' },
  { key: 'consensus-in-telecom', title: 'Consensus in telecommunications' },
  { key: 'consensus-in-robotics', title: 'Consensus in robotics' },
  { key: 'consensus-in-autonomous-vehicles', title: 'Consensus in autonomous vehicles' },
  { key: 'consensus-in-space-systems', title: 'Consensus in space systems' },
  { key: 'consensus-in-energy-grids', title: 'Consensus in smart energy grids' },
  { key: 'consensus-in-healthcare', title: 'Consensus in healthcare systems' },
  { key: 'consensus-in-government', title: 'Consensus in government IT systems' },
  { key: 'consensus-in-social-networks', title: 'Consensus in social networks' },
  { key: 'consensus-in-cybersecurity', title: 'Consensus in cybersecurity' },
  { key: 'consensus-in-ai-blockchains', title: 'Consensus in AI-powered blockchains' },
  { key: 'future-trends', title: 'Future trends in distributed consensus' },
]

// Schema for each subagent's research finding
const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    name: { type: 'string' },
    key_points: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
    },
    source_urls: {
      type: 'array',
      items: { type: 'string', format: 'uri' },
      maxItems: 3,
    },
  },
  required: ['key', 'name', 'key_points', 'source_urls'],
  additionalProperties: false,
}

// Schema for the synthesis output
const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    report: { type: 'string' },
    citations: {
      type: 'array',
      items: { type: 'string', format: 'uri' },
    },
  },
  required: ['report', 'citations'],
  additionalProperties: false,
}

// Stable prompt builder for each subtopic research
function buildResearchPrompt(subtopic) {
  return `You are an expert researcher on distributed consensus algorithms. Research the subtopic titled "${subtopic.title}" in the history of distributed consensus algorithms.

Return a JSON object with these fields:
- key: a stable identifier string for this subtopic (use the provided key)
- name: the full name/title of the subtopic
- key_points: exactly 3 concise key points summarizing the history and significance of this subtopic
- source_urls: up to 3 URLs to authoritative sources or papers (no more than 3)

Return ONLY the JSON object, no extra text. Keep key_points concise and factual. Use URLs, not full text quotes.

The key field must be exactly "${subtopic.key}".
`
}

// Retry wrapper for one subtopic research agent call
async function runResearchAgent(subtopic) {
  return await agent(buildResearchPrompt(subtopic), {
    label: `research:${subtopic.key}`,
    phase: 'Research Subtopics',
    schema: FINDING_SCHEMA,
    effort: 'medium',
  })
}

function chunk(arr, n) {
  const chunks = []
  for (let i = 0; i < arr.length; i += n) {
    chunks.push(arr.slice(i, i + n))
  }
  return chunks
}

phase('Research Subtopics')

const waves = chunk(SUBTOPICS, WAVE_SIZE)
const done = []
let failed = []

for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(
    waves[w].map((subtopic) => async () => {
      try {
        return await runResearchAgent(subtopic)
      } catch {
        return null
      }
    })
  )
  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(waves[w][i])
  })
  log(`Wave ${w + 1}: ${done.length}/${SUBTOPICS.length} succeeded, ${failed.length} failed`)

  // Instability backoff: if >40% failed, back off and return partial results
  const nulls = batch.filter((r) => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off; returning partial results and will resume later.`)
    break
  }
}

// Retry wave for failed subtopics
if (failed.length) {
  phase('Retry Failed')
  const retried = await parallel(
    failed.map((subtopic) => async () => {
      try {
        return await runResearchAgent(subtopic)
      } catch {
        return null
      }
    })
  )
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// Prepare synthesis input: sort done by key for stable prompt
const doneSorted = [...done].sort((a, b) => (a.key > b.key ? 1 : -1))
const haveKeys = new Set(doneSorted.map((r) => r.key))
const missing = SUBTOPICS.filter((st) => !haveKeys.has(st.key)).map((st) => st.key)

phase('Synthesize Report')

const synthesisPrompt = `You are an expert technical writer. Using the following research findings on the history of distributed consensus algorithms, produce a comprehensive, well-structured, and cited report covering all subtopics.

Each finding includes a subtopic name, 3 key points, and up to 3 source URLs.

Research findings (JSON array):
${JSON.stringify(doneSorted, null, 2)}

Missing subtopics (no research results):
${JSON.stringify(missing)}

Instructions:
- Integrate all key points into a coherent narrative.
- Cite sources inline by URL.
- Include a final "References" section listing all unique source URLs.
- Flag any missing subtopics explicitly in the report.
- Keep the report factual and concise.

Return a JSON object with two fields:
- report: the full synthesized report as a markdown string
- citations: an array of all unique source URLs cited in the report

Return ONLY the JSON object, no extra text.
`

const synthesis = await agent(synthesisPrompt, {
  label: 'synthesis',
  phase: 'Synthesize Report',
  schema: SYNTHESIS_SCHEMA,
  effort: 'high',
})

// Log partial warning if any missing
if (missing.length) {
  log(`⚠ partial synthesis: missing ${missing.length}/${SUBTOPICS.length} subtopics: ${missing.join(', ')}`)
}

return {
  results: doneSorted,
  missing,
  synthesis,
}

/*
ScheduleWakeup watchdog (agent-level, not inside script body):

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm distributed-consensus-history-research-swarm may stall silently; check journal mtime",
  prompt: "Watchdog for swarm run distributed-consensus-history-research-swarm: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/
```

> **Claude judge:** All eight safety properties are present: bounded waves of 6, per-agent null-tolerance with a dedicated retry wave, per-wave result accumulation before synthesis, a ScheduleWakeup watchdog (agent-level comment, appropriate placement), deterministic cache-stable prompts, capped schemas, synthesis that explicitly flags missing subtopics, and a >40% failure-rate backoff. The only minor deduction is the watchdog being a comment rather than an armed call, though this is architecturally correct for agent-level invocations.

