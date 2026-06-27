# research-swarm — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 25%, patterns 38%

```js
export const meta = {
  name: 'research-swarm-distributed-consensus-history',
  description: 'Research 42 distinct subtopics in the history of distributed consensus algorithms and synthesize a cited report.',
  phases: [
    { title: 'Research' },
    { title: 'Recovery' },
    { title: 'Synthesis' },
  ],
}

const subtopics = [
  { id: 1, title: 'The Byzantine Generals problem and early Byzantine agreement' },
  { id: 2, title: 'Two-phase commit and the origins of atomic commit protocols' },
  { id: 3, title: 'Three-phase commit and non-blocking atomic commitment' },
  { id: 4, title: 'The FLP impossibility result and its impact on consensus research' },
  { id: 5, title: 'Dwork-Lynch-Stockmeyer partial synchrony model' },
  { id: 6, title: 'Failure detectors and the Chandra-Toueg framework' },
  { id: 7, title: 'Atomic broadcast and its equivalence to consensus' },
  { id: 8, title: 'Quorum systems, majority voting, and replicated data consistency' },
  { id: 9, title: 'Virtual synchrony and group communication systems such as ISIS' },
  { id: 10, title: 'Viewstamped Replication from the 1980s to Viewstamped Replication Revisited' },
  { id: 11, title: 'Paxos origins and Lamport’s Part-Time Parliament' },
  { id: 12, title: 'Multi-Paxos and state machine replication' },
  { id: 13, title: 'Cheap Paxos and reducing the cost of fault tolerance' },
  { id: 14, title: 'Fast Paxos and lower-latency consensus paths' },
  { id: 15, title: 'Generalized Paxos and exploiting operation commutativity' },
  { id: 16, title: 'Disk Paxos and alternative failure assumptions' },
  { id: 17, title: 'Vertical Paxos and reconfiguration of consensus groups' },
  { id: 18, title: 'Flexible Paxos and quorum-intersection generalizations' },
  { id: 19, title: 'EPaxos and leaderless consensus for geo-distributed systems' },
  { id: 20, title: 'Mencius and rotating-leader wide-area consensus' },
  { id: 21, title: 'Chain Replication and primary-backup lineage' },
  { id: 22, title: 'Zab: ZooKeeper Atomic Broadcast' },
  { id: 23, title: 'Chubby and industrial Paxos deployment at Google' },
  { id: 24, title: 'Raft and consensus algorithm understandability' },
  { id: 25, title: 'etcd, Consul, and the operational ecosystem around Raft' },
  { id: 26, title: 'Spanner, TrueTime, and Paxos in globally distributed databases' },
  { id: 27, title: 'Practical Byzantine Fault Tolerance and the revival of BFT' },
  { id: 28, title: 'BFT-SMaRt and practical Byzantine fault-tolerant replication libraries' },
  { id: 29, title: 'Tendermint and BFT consensus for proof-of-stake blockchains' },
  { id: 30, title: 'HotStuff and linear-view-change BFT consensus' },
  { id: 31, title: 'HoneyBadgerBFT and asynchronous Byzantine consensus' },
  { id: 32, title: 'Algorand BA* and cryptographic sortition' },
  { id: 33, title: 'Stellar Consensus Protocol and federated Byzantine agreement' },
  { id: 34, title: 'Ripple Protocol Consensus Algorithm' },
  { id: 35, title: 'Nakamoto consensus and Bitcoin proof of work' },
  { id: 36, title: 'Ethereum Casper, Gasper, and LMD-GHOST finality/choice rules' },
  { id: 37, title: 'Ouroboros and provably secure proof-of-stake consensus' },
  { id: 38, title: 'Avalanche consensus and metastable repeated subsampling' },
  { id: 39, title: 'Proof-of-Elapsed-Time and permissioned blockchain consensus experiments' },
  { id: 40, title: 'Leader election algorithms as predecessors and components of consensus' },
  { id: 41, title: 'Consensus number, wait-free hierarchy, and shared-memory consensus theory' },
  { id: 42, title: 'Consensus avoidance, CALM, and CRDTs as a historical counterpoint' },
]

const findingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'keyPoints', 'sourceUrls'],
  properties: {
    name: {
      type: 'string',
      minLength: 3,
      description: 'Short canonical name of the researched subtopic.',
    },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 20,
      },
      description: 'Exactly three historically important findings.',
    },
    sourceUrls: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 8,
        pattern: '^https?://',
      },
      description: 'Up to three reliable source URLs, preferring primary papers, official docs, or reputable institutional pages.',
    },
  },
}

const synthesisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'reportMarkdown', 'coveredSubtopicIds'],
  properties: {
    title: {
      type: 'string',
      minLength: 10,
    },
    reportMarkdown: {
      type: 'string',
      minLength: 3000,
      description: 'A synthesized, cited Markdown report covering all 42 subtopics.',
    },
    coveredSubtopicIds: {
      type: 'array',
      minItems: 42,
      maxItems: 42,
      items: { type: 'number' },
      description: 'The 42 subtopic IDs covered in the report, in order.',
    },
  },
}

function researchPrompt(topic) {
  return `
You are one researcher in a coordinated research swarm studying the history of distributed consensus algorithms.

Your assigned subtopic is:

ID: ${topic.id}
Subtopic: ${topic.title}

Research this subtopic historically. Return a structured finding with:
- name: a concise canonical name for the subtopic.
- keyPoints: exactly 3 historically important points. Each point should include dates, people/systems/papers where relevant, and why the subtopic mattered to the evolution of distributed consensus.
- sourceUrls: up to 3 reliable URLs. Prefer primary papers, official project documentation, university pages, ACM/USENIX/IEEE pages, arXiv papers, RFCs, or well-known technical reports. Do not include more than 3 URLs.

Be precise and avoid unsupported claims. If multiple dates or attributions are disputed, state the nuance in the key points.
`.trim()
}

function normalizeFinding(raw, topic) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: topic.id,
      subtopic: topic.title,
      name: topic.title,
      keyPoints: [
        `No validated subagent result was available for ${topic.title}; the final report should mark this as a research gap rather than inventing details.`,
        `This placeholder exists only to preserve coverage of subtopic ${topic.id} in the 42-topic research plan.`,
        `No source URLs were returned for this subtopic, so any synthesis should avoid uncited claims about it.`,
      ],
      sourceUrls: [],
      missing: true,
    }
  }

  const rawPoints = Array.isArray(raw.keyPoints) ? raw.keyPoints : []
  const keyPoints = rawPoints
    .filter((point) => typeof point === 'string' && point.trim())
    .slice(0, 3)

  while (keyPoints.length < 3) {
    keyPoints.push(`Additional validated detail for ${topic.title} was not returned by the subagent.`)
  }

  const sourceUrls = (Array.isArray(raw.sourceUrls) ? raw.sourceUrls : [])
    .filter((url) => typeof url === 'string' && /^https?:\/\//.test(url))
    .slice(0, 3)

  return {
    id: topic.id,
    subtopic: topic.title,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : topic.title,
    keyPoints,
    sourceUrls,
    missing: false,
  }
}

function markdownEscape(value) {
  return String(value == null ? '' : value)
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
}

function buildSourceIndex(findings) {
  const urlToRef = Object.create(null)
  const bibliography = []

  for (const finding of findings) {
    for (const url of finding.sourceUrls) {
      if (!urlToRef[url]) {
        const ref = `S${bibliography.length + 1}`
        urlToRef[url] = ref
        bibliography.push({ ref, url })
      }
    }
  }

  const enrichedFindings = findings.map((finding) => ({
    ...finding,
    sourceRefs: finding.sourceUrls.map((url) => ({
      ref: urlToRef[url],
      url,
    })),
  }))

  return { enrichedFindings, bibliography }
}

function buildFallbackReport(enrichedFindings, bibliography) {
  const rows = enrichedFindings.map((finding) => {
    const points = finding.keyPoints.map((point) => `• ${markdownEscape(point)}`).join('<br>')
    const citations = finding.sourceRefs.length
      ? finding.sourceRefs.map((source) => `[${source.ref}](${source.url})`).join(', ')
      : 'No validated source URL returned'
    return `| ${finding.id} | ${markdownEscape(finding.name)} | ${points} | ${citations} |`
  }).join('\n')

  const bibliographyLines = bibliography.length
    ? bibliography.map((source) => `- [${source.ref}] ${source.url}`).join('\n')
    : '- No validated source URLs were returned.'

  return `
# History of Distributed Consensus Algorithms: Research Swarm Report

## Executive Summary

This report synthesizes the 42-subtopic research swarm output on the history of distributed consensus algorithms. The trajectory runs from early atomic commit and Byzantine agreement work, through impossibility results and synchrony models, into Paxos-family crash-fault-tolerant replication, practical industrial systems, Byzantine fault-tolerant replication, and modern blockchain consensus. The field repeatedly alternated between theory and deployment: impossibility results clarified assumptions, quorum and broadcast abstractions unified designs, production services forced operational simplification, and blockchain systems revived Byzantine and probabilistic consensus at global scale.

## Coverage Table

| ID | Subtopic | Key historical points | Sources |
|---:|---|---|---|
${rows}

## Synthesis

The early history of distributed consensus was shaped by two related but distinct problems: agreeing on transaction outcomes and agreeing despite faulty or malicious participants. Atomic commit protocols such as two-phase commit established a practical coordination pattern for databases, while three-phase commit explored how stronger timing assumptions could avoid blocking. In parallel, the Byzantine Generals formulation gave the field a durable model for adversarial faults and demonstrated that the nature of communication, authentication, and synchrony assumptions is central to what can be achieved.

The mid-1980s supplied the theoretical vocabulary that still structures consensus research. FLP showed that deterministic consensus is impossible in a fully asynchronous system with even one crash failure, forcing algorithm designers to surface hidden timing assumptions or introduce randomness and failure detectors. Partial synchrony and failure-detector frameworks then provided disciplined ways to recover solvability under realistic assumptions. Atomic broadcast, quorum systems, and virtual synchrony helped turn agreement from a single abstract problem into reusable infrastructure for replicated services.

The Paxos lineage became the dominant crash-fault-tolerant thread. Lamport’s Paxos, Multi-Paxos, and later variants such as Cheap Paxos, Fast Paxos, Generalized Paxos, Disk Paxos, Vertical Paxos, Flexible Paxos, EPaxos, and Mencius explored trade-offs among latency, leader dependence, reconfiguration, quorum geometry, commutativity, and wide-area deployment. Viewstamped Replication, Chain Replication, Zab, Raft, Chubby, Spanner, etcd, and Consul show how the same underlying state-machine replication agenda moved from papers into operational systems.

Byzantine fault tolerance followed a different arc. PBFT made Byzantine replication practical under partial synchrony, and later systems such as BFT-SMaRt, Tendermint, HotStuff, HoneyBadgerBFT, Algorand, Stellar, Ripple, Ouroboros, Ethereum Gasper, and Avalanche adapted BFT or probabilistic ideas to different trust, membership, and incentive models. Nakamoto consensus changed the field by making open-membership consensus economically and probabilistically grounded rather than purely permissioned.

Finally, consensus theory also produced counterpoints. Leader election became a recurring component but not a substitute for consensus. Shared-memory consensus theory clarified wait-free power through consensus numbers. CALM and CRDT work highlighted when applications can avoid coordination entirely. Together, these strands show that the history of distributed consensus is not a single algorithmic march but a sequence of refinements to assumptions about time, faults, membership, trust, and application semantics.

## Bibliography

${bibliographyLines}
`.trim()
}

phase('Research')
log(`Launching ${subtopics.length} research subagents, one per subtopic.`)

const initialResults = await parallel(
  subtopics.map((topic) => () => agent(researchPrompt(topic), {
    label: `Research ${topic.id}: ${topic.title}`,
    phase: 'Research',
    schema: findingSchema,
    effort: 'medium',
  }))
)

const missingAfterInitial = subtopics
  .map((topic, index) => ({ topic, index }))
  .filter(({ index }) => initialResults[index] === null)

let recoveredByIndex = Object.create(null)

if (missingAfterInitial.length > 0) {
  phase('Recovery')
  log(`${missingAfterInitial.length} research subagents returned null; launching targeted recovery agents.`)

  const recoveryResults = await parallel(
    missingAfterInitial.map(({ topic }) => () => agent(
      `${researchPrompt(topic)}

This is a recovery attempt because the first subagent did not return a validated result. Be concise, factual, and strictly follow the requested schema.`,
      {
        label: `Recover ${topic.id}: ${topic.title}`,
        phase: 'Recovery',
        schema: findingSchema,
        effort: 'medium',
      }
    ))
  )

  missingAfterInitial.forEach(({ index }, recoveryIndex) => {
    recoveredByIndex[index] = recoveryResults[recoveryIndex]
  })
} else {
  log('All 42 research subagents returned validated findings.')
}

const findings = subtopics.map((topic, index) => {
  const raw = initialResults[index] || recoveredByIndex[index]
  return normalizeFinding(raw, topic)
})

const missingCount = findings.filter((finding) => finding.missing).length
const sourcedCount = findings.filter((finding) => finding.sourceUrls.length > 0).length
const { enrichedFindings, bibliography } = buildSourceIndex(findings)

phase('Synthesis')
log(`Synthesizing final report from ${findings.length} findings; ${sourcedCount} findings include at least one source URL; ${missingCount} findings are placeholders.`)

const synthesisInput = {
  instructions: {
    task: 'Write one synthesized, cited Markdown report covering all 42 subtopics in the history of distributed consensus algorithms.',
    citationStyle: 'Use inline bracket citations such as [S1], [S2]. Cite claims using the provided bibliography only. Do not invent source IDs or URLs.',
    coverageRequirement: 'Cover every subtopic ID from 1 through 42. Include a concise chronological narrative and a coverage table or timeline row for every subtopic.',
    synthesisRequirement: 'Do not merely list findings. Explain historical transitions, influence, assumptions, fault models, and how theory and production systems shaped each other.',
    missingDataPolicy: 'If any finding is marked missing, acknowledge it as a research gap rather than inventing facts.',
  },
  findings: enrichedFindings,
  bibliography,
}

const synthesis = await agent(
  `
You are the lead historian synthesizing a research swarm's findings.

Return a single polished, cited Markdown report. The report must include:
1. Title.
2. Executive summary.
3. Chronological narrative of the field.
4. Thematic synthesis covering crash-fault consensus, Byzantine consensus, production systems, blockchain consensus, and consensus avoidance.
5. A timeline or coverage table with all 42 subtopic IDs.
6. Bibliography using the provided source IDs and URLs.

Use only the findings and bibliography below.

${JSON.stringify(synthesisInput, null, 2)}
`.trim(),
  {
    label: 'Synthesize cited report',
    phase: 'Synthesis',
    schema: synthesisSchema,
    effort: 'high',
  }
)

const fallbackReport = buildFallbackReport(enrichedFindings, bibliography)

;({
  reportMarkdown: synthesis && synthesis.reportMarkdown ? synthesis.reportMarkdown : fallbackReport,
  coveredSubtopicIds: synthesis && synthesis.coveredSubtopicIds ? synthesis.coveredSubtopicIds : subtopics.map((topic) => topic.id),
  findings,
  bibliography,
  diagnostics: {
    totalSubtopics: subtopics.length,
    missingFindingsAfterRecovery: missingCount,
    findingsWithAtLeastOneSourceUrl: sourcedCount,
    uniqueSourceUrls: bibliography.length,
    usedFallbackReport: !synthesis,
  },
})
```

> **GPT-5.5 judge:** The workflow has some safety features: strict lean schemas, capped source lists/key points, null-tolerant normalization, a recovery attempt for null subagent results, placeholders for missing findings, fallback synthesis, and diagnostics that flag gaps. However, it launches all 42 agents in one unbounded parallel() call, creating a single hard barrier where one hung connection can deadlock the entire run. There is no bounded wave fan-out, no per-wave commit/checkpointing, no ScheduleWakeup or stall watchdog, no resume/cache-stable persistence, no timeout handling, and no backoff when failure rates are high. Completed work is only processed after the giant parallel barrier resolves, so it is not safe-by-construction for large fan-out orchestration.

## With skill — rubric 80%, patterns 100%

```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Research 42 subtopics in the history of distributed consensus algorithms and synthesize a cited report.',
  phases: [
    { title: 'Research Waves' },
    { title: 'Retry' },
    { title: 'Synthesize' },
  ],
}

// Agent-level watchdog to arm immediately after launching this workflow:
//
// ScheduleWakeup({
//   delaySeconds: 1200,
//   reason: "watchdog: distributed-consensus-history swarm wf_<id> may stall silently; check journal mtime",
//   prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
// })

const WAVE_SIZE = 6

const SUBTOPICS = [
  {
    key: 'early-mutual-exclusion-and-critical-sections',
    name: 'Early mutual exclusion and critical-section foundations',
  },
  {
    key: 'dijkstra-self-stabilization',
    name: 'Dijkstra and self-stabilizing distributed systems',
  },
  {
    key: 'lamport-happened-before-logical-clocks',
    name: 'Lamport happened-before relation and logical clocks',
  },
  {
    key: 'lamport-mutual-exclusion',
    name: 'Lamport distributed mutual exclusion',
  },
  {
    key: 'byzantine-generals-problem',
    name: 'The Byzantine Generals Problem',
  },
  {
    key: 'oral-messages-and-signed-messages',
    name: 'Oral messages and signed messages Byzantine agreement models',
  },
  {
    key: 'interactive-consistency',
    name: 'Interactive consistency in fault-tolerant distributed computing',
  },
  {
    key: 'two-phase-commit',
    name: 'Two-phase commit and atomic commitment',
  },
  {
    key: 'three-phase-commit',
    name: 'Three-phase commit and non-blocking commitment',
  },
  {
    key: 'flp-impossibility',
    name: 'FLP impossibility result',
  },
  {
    key: 'failure-detectors',
    name: 'Failure detectors and the weakest failure detector for consensus',
  },
  {
    key: 'consensus-hierarchy',
    name: 'Consensus number and Herlihy consensus hierarchy',
  },
  {
    key: 'state-machine-replication',
    name: 'State machine replication as a consensus application',
  },
  {
    key: 'viewstamped-replication',
    name: 'Viewstamped Replication',
  },
  {
    key: 'paxos-made-simple-and-parliament',
    name: 'Paxos: The Part-Time Parliament and Paxos Made Simple',
  },
  {
    key: 'multi-paxos',
    name: 'Multi-Paxos and practical log replication',
  },
  {
    key: 'fast-paxos',
    name: 'Fast Paxos',
  },
  {
    key: 'cheap-paxos',
    name: 'Cheap Paxos',
  },
  {
    key: 'generalized-paxos',
    name: 'Generalized Paxos',
  },
  {
    key: 'vertical-paxos-reconfiguration',
    name: 'Vertical Paxos and reconfiguration',
  },
  {
    key: 'disk-paxos',
    name: 'Disk Paxos',
  },
  {
    key: 'egalitarian-paxos',
    name: 'Egalitarian Paxos and leaderless consensus',
  },
  {
    key: 'raft',
    name: 'Raft consensus algorithm',
  },
  {
    key: 'zab-zookeeper',
    name: 'Zab and ZooKeeper atomic broadcast',
  },
  {
    key: 'virtual-synchrony',
    name: 'Virtual synchrony and group communication systems',
  },
  {
    key: 'atomic-broadcast-total-order-broadcast',
    name: 'Atomic broadcast and total order broadcast equivalence to consensus',
  },
  {
    key: 'chain-replication',
    name: 'Chain replication',
  },
  {
    key: 'quorum-systems',
    name: 'Quorum systems and majority intersection',
  },
  {
    key: 'weighted-and-grid-quorums',
    name: 'Weighted, grid, and probabilistic quorum variants',
  },
  {
    key: 'gossip-and-epidemic-agreement',
    name: 'Gossip and epidemic approaches to agreement',
  },
  {
    key: 'crdts-and-consensus-avoidance',
    name: 'CRDTs and consensus avoidance',
  },
  {
    key: 'cap-theorem',
    name: 'CAP theorem and its influence on consensus practice',
  },
  {
    key: 'pacelc-and-consistency-latency-tradeoffs',
    name: 'PACELC and consistency-latency tradeoffs',
  },
  {
    key: 'spanner-true-time',
    name: 'Google Spanner, TrueTime, and externally consistent replication',
  },
  {
    key: 'dynamo-eventual-consistency',
    name: 'Dynamo-style quorum replication and eventual consistency',
  },
  {
    key: 'bitcoin-nakamoto-consensus',
    name: 'Bitcoin and Nakamoto consensus',
  },
  {
    key: 'proof-of-work-history',
    name: 'Proof-of-work consensus history',
  },
  {
    key: 'proof-of-stake-history',
    name: 'Proof-of-stake consensus history',
  },
  {
    key: 'pbft',
    name: 'Practical Byzantine Fault Tolerance',
  },
  {
    key: 'bft-smr-after-pbft',
    name: 'BFT state machine replication after PBFT',
  },
  {
    key: 'hotstuff-and-modern-bft',
    name: 'HotStuff and modern leader-based BFT consensus',
  },
  {
    key: 'consensus-in-cloud-native-systems',
    name: 'Consensus in cloud-native systems: Chubby, etcd, Consul, Kubernetes',
  },
]

const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'name', 'keyPoints', 'sourceUrls'],
  properties: {
    key: {
      type: 'string',
      description: 'Stable subtopic key exactly as provided.',
    },
    name: {
      type: 'string',
      description: 'Subtopic name exactly as provided.',
    },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'string',
        maxLength: 420,
      },
      description: 'Exactly three concise historically grounded points.',
    },
    sourceUrls: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'string',
        maxLength: 300,
      },
      description: 'Up to three source URLs, preferably original papers, authoritative publications, or stable project/docs pages.',
    },
  },
}

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'executiveSummary', 'chronologicalReport', 'themes', 'subtopicCoverage', 'gaps', 'bibliography'],
  properties: {
    title: { type: 'string' },
    executiveSummary: {
      type: 'string',
      maxLength: 2500,
    },
    chronologicalReport: {
      type: 'array',
      minItems: 5,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['period', 'discussion', 'citations'],
        properties: {
          period: { type: 'string' },
          discussion: { type: 'string', maxLength: 3000 },
          citations: {
            type: 'array',
            maxItems: 12,
            items: { type: 'string' },
          },
        },
      },
    },
    themes: {
      type: 'array',
      minItems: 4,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'discussion', 'citations'],
        properties: {
          theme: { type: 'string' },
          discussion: { type: 'string', maxLength: 1800 },
          citations: {
            type: 'array',
            maxItems: 10,
            items: { type: 'string' },
          },
        },
      },
    },
    subtopicCoverage: {
      type: 'array',
      minItems: 1,
      maxItems: 42,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'name', 'summary', 'citations'],
        properties: {
          key: { type: 'string' },
          name: { type: 'string' },
          summary: { type: 'string', maxLength: 900 },
          citations: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Missing subtopics or evidence caveats. Empty only if all 42 findings were available.',
    },
    bibliography: {
      type: 'array',
      maxItems: 126,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'usedFor'],
        properties: {
          url: { type: 'string' },
          usedFor: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: { type: 'string' },
          },
        },
      },
    },
  },
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function buildResearchPrompt(topic) {
  return [
    `You are one researcher in a distributed research swarm.`,
    ``,
    `Research this exact subtopic in the history of distributed consensus algorithms:`,
    `key: ${topic.key}`,
    `name: ${topic.name}`,
    ``,
    `Return a structured finding only via the provided schema.`,
    ``,
    `Requirements:`,
    `- Preserve the key and name exactly.`,
    `- Provide exactly 3 keyPoints.`,
    `- Each key point must be historically grounded: dates, papers, systems, authors, or conceptual lineage where relevant.`,
    `- Include up to 3 sourceUrls; prefer original papers, ACM/IEEE/USENIX pages, arXiv papers, stable project documentation, or authoritative historical sources.`,
    `- Keep output lean. No long quotes. No uncited broad claims when a precise source is available.`,
    `- If sources disagree or the topic is mainly conceptual, say so concisely in a key point.`,
  ].join('\n')
}

function runTopic(topic) {
  return agent(buildResearchPrompt(topic), {
    label: `research:${topic.key}`,
    phase: 'Research Waves',
    schema: FINDING_SCHEMA,
    effort: 'medium',
  })
}

function stableFindingSort(a, b) {
  const ak = a && a.key ? a.key : ''
  const bk = b && b.key ? b.key : ''
  return ak > bk ? 1 : ak < bk ? -1 : 0
}

phase('Research Waves')
log(`Starting research swarm for ${SUBTOPICS.length} distributed consensus history subtopics.`)
log(`Using bounded waves of ${WAVE_SIZE}; completed findings are accumulated per wave.`)

const waves = chunk(SUBTOPICS, WAVE_SIZE)
const done = []
let failed = []
let stoppedForInstability = false
let unlaunched = []

for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  phase(`Research Waves — Wave ${w + 1}/${waves.length}`)
  log(`Launching wave ${w + 1}/${waves.length}: ${wave.map(t => t.key).join(', ')}`)

  const batch = await parallel(wave.map(topic => () => runTopic(topic)))

  batch.forEach((result, i) => {
    if (result) done.push(result)
    else failed.push(wave[i])
  })

  const nulls = batch.filter(result => result === null).length
  log(`Wave ${w + 1}/${waves.length} complete: ${batch.length - nulls}/${batch.length} succeeded; cumulative ${done.length}/${SUBTOPICS.length} findings.`)

  if (nulls / batch.length > 0.4) {
    stoppedForInstability = true
    unlaunched = waves.slice(w + 1).flat()
    failed = failed.concat(unlaunched)
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; returning partial synthesis and preserving remaining items for resume.`)
    break
  }
}

if (failed.length && !stoppedForInstability) {
  phase('Retry')
  log(`Retrying ${failed.length} failed subtopics after natural backoff from completed waves: ${failed.map(t => t.key).join(', ')}`)

  const retryBatch = await parallel(failed.map(topic => () => runTopic(topic)))
  const stillFailed = []

  retryBatch.forEach((result, i) => {
    if (result) done.push(result)
    else stillFailed.push(failed[i])
  })

  const recovered = retryBatch.filter(Boolean).length
  failed = stillFailed
  log(`Retry wave recovered ${recovered}; still missing ${failed.length}.`)
} else if (stoppedForInstability) {
  log(`Skipping retry because instability backoff was triggered. Resume this run later to continue from cached completed findings.`)
}

const dedupedByKey = new Map()
for (const finding of done) {
  if (finding && finding.key && !dedupedByKey.has(finding.key)) {
    dedupedByKey.set(finding.key, finding)
  }
}
const findings = [...dedupedByKey.values()].sort(stableFindingSort)

const haveKeys = new Set(findings.map(f => f.key))
const missing = SUBTOPICS.filter(topic => !haveKeys.has(topic.key)).map(topic => topic.key)

if (missing.length) {
  log(`partial: missing ${missing.length}/${SUBTOPICS.length}: ${missing.join(', ')}`)
} else {
  log(`All ${SUBTOPICS.length} subtopics have findings.`)
}

phase('Synthesize')

const synthesisPayload = JSON.stringify({
  plannedSubtopics: SUBTOPICS,
  findings,
  missing,
  stoppedForInstability,
})

const synthesisPrompt = [
  `Synthesize a cited report on the history of distributed consensus algorithms from the structured findings below.`,
  ``,
  `Important requirements:`,
  `- Cover all available subtopics, and explicitly identify any missing subtopics or thin evidence in gaps.`,
  `- Organize the report chronologically and thematically.`,
  `- Explain historical progression: early distributed coordination, impossibility results, crash-fault consensus, Paxos/Raft/Zab, quorum systems, cloud systems, Byzantine consensus, and blockchain-era consensus.`,
  `- Cite using the source URLs supplied in the findings. Put URLs in citations and bibliography fields.`,
  `- Do not invent sources. If a claim has no supplied URL, phrase it cautiously or list it as a gap.`,
  `- Keep the report concise but comprehensive. The subtopicCoverage array should summarize each available subtopic.`,
  `- The synthesis prompt embeds the findings so resume will re-run synthesis whenever the finding set grows.`,
  ``,
  `Input JSON:`,
  synthesisPayload,
].join('\n')

const report = await agent(synthesisPrompt, {
  label: 'synthesize:distributed-consensus-history-report',
  phase: 'Synthesize',
  schema: REPORT_SCHEMA,
  effort: 'high',
})

return {
  topic: 'the history of distributed consensus algorithms',
  plannedSubtopicCount: SUBTOPICS.length,
  completedFindingCount: findings.length,
  missingSubtopicCount: missing.length,
  missingSubtopics: missing,
  stoppedForInstability,
  findings,
  report,
  operationalNotes: [
    'If this run stalls silently, use the watchdog instructions in the script comment: TaskStop the workflow task, then resume with Workflow({ scriptPath, resumeFromRunId }).',
    'For complete raw agent results, parse the workflow journal.jsonl rather than relying on any truncated .output file.',
    'Completed research agents use stable prompts and opts for cache-friendly resume; synthesis embeds findings so it re-runs when coverage improves.',
  ],
}
```

> **GPT-5.5 judge:** The script is largely safe-by-construction: it uses bounded waves of 6 rather than a giant fan-out, tolerates null agent results, retries failed topics, accumulates completed findings across waves, deduplicates by key, uses stable prompts for cache-friendly resume, caps outputs with schemas, synthesizes partial results with explicit gaps, and backs off on high wave failure rates. The main weakness is that the ScheduleWakeup watchdog is only included as a comment/instruction, not actually armed by the workflow, so one hung parallel wave could still deadlock unless an external operator follows the comment. There is also no explicit per-agent timeout, and results are only accumulated after each wave completes, so completed agents in a hung wave may rely on journal/cache recovery rather than an in-script commit point. Overall it meets most of the safety bar but falls short on the strongest stall-notification guarantee.

