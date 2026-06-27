# research-swarm — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 35%, patterns 50%

```js
export const meta = {
  name: 'research-swarm-distributed-consensus-history',
  description:
    'Researches 42 distinct subtopics in the history of distributed consensus algorithms and synthesizes a cited report.',
  phases: [
    { title: 'Research swarm' },
    { title: 'Retry missing or uncited findings' },
    { title: 'Synthesize cited report' },
  ],
}

const config = args && typeof args === 'object' ? args : {}

const allowedEfforts = new Set(['low', 'medium', 'high', 'xhigh', 'max'])
const researchEffort = allowedEfforts.has(config.researchEffort)
  ? config.researchEffort
  : 'medium'
const synthesisEffort = allowedEfforts.has(config.synthesisEffort)
  ? config.synthesisEffort
  : 'high'

const researchModel = typeof config.researchModel === 'string' ? config.researchModel : null
const synthesisModel = typeof config.synthesisModel === 'string' ? config.synthesisModel : null

const subtopics = [
  {
    id: 1,
    name: 'SIFT and early fault-tolerant distributed systems',
    focus:
      'How early aerospace and fault-tolerant computing projects framed agreement, replication, and voting before modern consensus terminology matured.',
  },
  {
    id: 2,
    name: 'Two-Phase Commit (2PC)',
    focus:
      'The history of atomic commit protocols in databases and their relationship to consensus under coordinator failures.',
  },
  {
    id: 3,
    name: 'Three-Phase Commit (3PC)',
    focus:
      'The attempt to make atomic commit non-blocking under stronger timing assumptions and why it mattered historically.',
  },
  {
    id: 4,
    name: 'State Machine Replication foundations',
    focus:
      'The emergence of replicated deterministic state machines as the central abstraction for consensus-based fault tolerance.',
  },
  {
    id: 5,
    name: 'The Byzantine Generals Problem',
    focus:
      'The 1982 formulation by Lamport, Shostak, and Pease and its role in defining Byzantine agreement.',
  },
  {
    id: 6,
    name: 'Signed and oral-message Byzantine agreement algorithms',
    focus:
      'Early synchronous Byzantine agreement algorithms, including authenticated versus unauthenticated message assumptions.',
  },
  {
    id: 7,
    name: 'The FLP impossibility result',
    focus:
      'The Fischer-Lynch-Paterson impossibility theorem and its impact on asynchronous consensus research.',
  },
  {
    id: 8,
    name: 'Partial synchrony and the DLS model',
    focus:
      'Dwork, Lynch, and Stockmeyer’s partial synchrony model as a bridge between impossibility and practical consensus.',
  },
  {
    id: 9,
    name: 'Unreliable failure detectors',
    focus:
      'Chandra and Toueg’s failure-detector framework and its historical importance for solving consensus in asynchronous systems with extra assumptions.',
  },
  {
    id: 10,
    name: 'Atomic broadcast and consensus equivalence',
    focus:
      'The historical development of total-order broadcast and its formal equivalence to consensus.',
  },
  {
    id: 11,
    name: 'Quorum systems and weighted voting',
    focus:
      'The evolution of quorum-based replication and voting schemes that influenced Paxos and later consensus protocols.',
  },
  {
    id: 12,
    name: 'Viewstamped Replication',
    focus:
      'The original Oki-Liskov Viewstamped Replication protocol and its place alongside Paxos in crash-fault-tolerant replication.',
  },
  {
    id: 13,
    name: 'Paxos origins and The Part-Time Parliament',
    focus:
      'Lamport’s Paxos algorithm, its delayed publication history, and the consensus ideas behind the fictional parliament presentation.',
  },
  {
    id: 14,
    name: 'Multi-Paxos',
    focus:
      'How Paxos was adapted from single-decree consensus into efficient replicated-log consensus for long-running systems.',
  },
  {
    id: 15,
    name: 'Disk Paxos',
    focus:
      'Lamport and Gafni’s disk-based Paxos variant and what it reveals about processors, disks, and failure models.',
  },
  {
    id: 16,
    name: 'Cheap Paxos',
    focus:
      'Lamport and Massa’s work on reducing the cost of Paxos by using auxiliary acceptors and cheaper fault tolerance.',
  },
  {
    id: 17,
    name: 'Fast Paxos',
    focus:
      'The Fast Paxos variant and its historical attempt to reduce message delays in consensus decisions.',
  },
  {
    id: 18,
    name: 'Generalized Paxos',
    focus:
      'Lamport’s Generalized Paxos and the move from totally ordered commands to partially ordered compatible commands.',
  },
  {
    id: 19,
    name: 'Vertical Paxos and reconfiguration',
    focus:
      'Vertical Paxos, master-managed configuration changes, and the history of dynamic membership in Paxos systems.',
  },
  {
    id: 20,
    name: 'Flexible Paxos',
    focus:
      'The quorum-intersection insight behind Flexible Paxos and its place in later Paxos optimization history.',
  },
  {
    id: 21,
    name: 'Paxos Made Simple and Paxos pedagogy',
    focus:
      'How simplified presentations, explanations, and engineering papers changed Paxos adoption and understanding.',
  },
  {
    id: 22,
    name: 'Chubby and production Paxos at Google',
    focus:
      'The Chubby lock service as a landmark production use of Paxos and its influence on distributed systems engineering.',
  },
  {
    id: 23,
    name: 'Spanner, TrueTime, and Paxos',
    focus:
      'How Google Spanner combined Paxos replication with TrueTime to support externally consistent distributed transactions.',
  },
  {
    id: 24,
    name: 'Virtual synchrony and ISIS',
    focus:
      'Birman’s ISIS system, virtual synchrony, group membership, and their historical relationship to agreement and atomic multicast.',
  },
  {
    id: 25,
    name: 'Primary-backup replication and chain replication',
    focus:
      'The historical role of primary-backup protocols and chain replication as practical replication approaches adjacent to consensus.',
  },
  {
    id: 26,
    name: 'ZooKeeper Atomic Broadcast (Zab)',
    focus:
      'Zab as the consensus/atomic-broadcast protocol behind ZooKeeper and its historical relationship to Paxos-style replicated logs.',
  },
  {
    id: 27,
    name: 'Raft',
    focus:
      'Raft’s design for understandability, leader election, log replication, and its historical impact on consensus adoption.',
  },
  {
    id: 28,
    name: 'Viewstamped Replication Revisited',
    focus:
      'The 2012 revisiting of Viewstamped Replication and how it clarified the family resemblance among VR, Paxos, and Raft.',
  },
  {
    id: 29,
    name: 'EPaxos',
    focus:
      'Egalitarian Paxos as a leaderless/low-latency consensus protocol exploiting command commutativity.',
  },
  {
    id: 30,
    name: 'Mencius and rotating-leader Paxos',
    focus:
      'Mencius and related efforts to distribute Paxos leadership to improve wide-area throughput and fairness.',
  },
  {
    id: 31,
    name: 'Practical Byzantine Fault Tolerance (PBFT)',
    focus:
      'Castro and Liskov’s PBFT and its importance in making Byzantine fault-tolerant state machine replication practical.',
  },
  {
    id: 32,
    name: 'Byzantine quorum systems',
    focus:
      'The development of Byzantine quorum ideas and their influence on BFT storage and consensus protocols.',
  },
  {
    id: 33,
    name: 'Tendermint',
    focus:
      'Tendermint’s BFT consensus design for blockchains and its combination of validators, rounds, locking, and finality.',
  },
  {
    id: 34,
    name: 'HotStuff',
    focus:
      'HotStuff’s linear-view-change BFT protocol and its influence on modern blockchain consensus systems.',
  },
  {
    id: 35,
    name: 'HoneyBadgerBFT',
    focus:
      'HoneyBadgerBFT and the resurgence of practical asynchronous Byzantine consensus using threshold cryptography and batching.',
  },
  {
    id: 36,
    name: 'Algorand BA*',
    focus:
      'Algorand’s cryptographic sortition and Byzantine agreement approach for public blockchain consensus.',
  },
  {
    id: 37,
    name: 'Stellar Federated Byzantine Agreement',
    focus:
      'Stellar’s federated Byzantine agreement model and quorum-slice approach to open-membership consensus.',
  },
  {
    id: 38,
    name: 'Ripple Protocol Consensus Algorithm',
    focus:
      'Ripple’s unique-node-list model and its historical role among federated and payment-network consensus protocols.',
  },
  {
    id: 39,
    name: 'Nakamoto consensus and Proof of Work',
    focus:
      'Bitcoin’s probabilistic consensus, longest-chain rule, and proof-of-work as a major historical shift in open-membership consensus.',
  },
  {
    id: 40,
    name: 'Proof-of-Stake consensus and finality gadgets',
    focus:
      'The historical evolution from proof-of-work to proof-of-stake protocols, including BFT-style finality mechanisms such as Casper FFG.',
  },
  {
    id: 41,
    name: 'Avalanche, Snowball, and metastable consensus',
    focus:
      'Avalanche-family protocols and their randomized sampling/metastability approach to blockchain consensus.',
  },
  {
    id: 42,
    name: 'Formal specification and verification of consensus algorithms',
    focus:
      'How TLA+, model checking, mechanized proofs, and verified implementations influenced the maturation of Paxos, Raft, and BFT protocols.',
  },
]

const findingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'keyPoints', 'sourceUrls'],
  properties: {
    name: {
      type: 'string',
      minLength: 3,
      description: 'Canonical name of the researched subtopic.',
    },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 20,
      },
      description:
        'Exactly three historically grounded key points about this subtopic.',
    },
    sourceUrls: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 8,
      },
      description:
        'Up to three source URLs. Prefer primary papers, stable project pages, publisher pages, or reputable technical sources.',
    },
  },
}

function agentOptions(label, effort, model, schema) {
  const opts = { label, effort }
  if (model) opts.model = model
  if (schema) opts.schema = schema
  return opts
}

function makeResearchPrompt(subtopic, retryContext) {
  return `
You are one researcher in a distributed research swarm.

Research this assigned subtopic in the history of distributed consensus algorithms:

Subtopic ${subtopic.id}: ${subtopic.name}
Focus: ${subtopic.focus}

Return a structured finding matching the provided schema:
- name: the canonical name of the subtopic.
- keyPoints: exactly 3 concise but information-dense historical points.
- sourceUrls: up to 3 source URLs.

Requirements:
1. Emphasize historical development: dates, authors, papers/systems, influence, and relationship to other consensus work.
2. Prefer primary or stable sources: original papers, author pages, ACM/IEEE/USENIX/Springer pages, arXiv, official project docs, or reputable institutional pages.
3. Do not invent URLs. If you are uncertain about a URL, omit it rather than guessing.
4. Keep each key point self-contained; the synthesis agent will combine it with 41 other findings.
5. Avoid generic explanations unless they explain historical significance.

${retryContext ? `Retry context: ${retryContext}` : ''}
`.trim()
}

function normalizeFinding(finding, subtopic) {
  if (!finding || typeof finding !== 'object') return null
  if (!Array.isArray(finding.keyPoints) || finding.keyPoints.length !== 3) return null

  const keyPoints = finding.keyPoints
    .map((point) => String(point || '').trim())
    .filter((point) => point.length > 0)

  if (keyPoints.length !== 3) return null

  const sourceUrls = Array.isArray(finding.sourceUrls)
    ? finding.sourceUrls
        .map((url) => String(url || '').trim())
        .filter((url) => url.length > 0)
        .slice(0, 3)
    : []

  return {
    subtopicId: subtopic.id,
    assignedSubtopic: subtopic.name,
    name: String(finding.name || subtopic.name).trim() || subtopic.name,
    keyPoints,
    sourceUrls,
  }
}

phase('Research swarm')
log(`Launching ${subtopics.length} research subagents, one per consensus-history subtopic.`)

const firstPassResults = await parallel(
  subtopics.map((subtopic) => async () =>
    agent(
      makeResearchPrompt(subtopic, ''),
      agentOptions(
        `Research ${subtopic.id}: ${subtopic.name}`,
        researchEffort,
        researchModel,
        findingSchema,
      ),
    ),
  ),
)

const findingsByIndex = firstPassResults.map((finding, index) =>
  normalizeFinding(finding, subtopics[index]),
)

const retryIndexes = findingsByIndex
  .map((finding, index) => ({ finding, index }))
  .filter(({ finding }) => !finding || finding.sourceUrls.length === 0)
  .map(({ index }) => index)

if (retryIndexes.length > 0) {
  phase('Retry missing or uncited findings')
  log(
    `Retrying ${retryIndexes.length} subtopics whose first result was missing, invalid, or lacked source URLs.`,
  )

  const retryResults = await parallel(
    retryIndexes.map((index) => async () => {
      const subtopic = subtopics[index]
      const existing = findingsByIndex[index]
      const retryContext = existing
        ? 'The first result had valid key points but no source URLs. Return the same kind of structured finding, but include at least one reliable source URL if possible.'
        : 'The first result was missing or failed schema validation. Return a complete structured finding.'

      return agent(
        makeResearchPrompt(subtopic, retryContext),
        agentOptions(
          `Retry ${subtopic.id}: ${subtopic.name}`,
          researchEffort,
          researchModel,
          findingSchema,
        ),
      )
    }),
  )

  retryResults.forEach((retryFinding, retryResultIndex) => {
    const originalIndex = retryIndexes[retryResultIndex]
    const normalized = normalizeFinding(retryFinding, subtopics[originalIndex])

    if (!normalized) return

    const current = findingsByIndex[originalIndex]
    if (!current || normalized.sourceUrls.length > 0) {
      findingsByIndex[originalIndex] = normalized
    }
  })
}

const completedFindings = findingsByIndex.filter(Boolean)
const missingSubtopics = subtopics.filter((_, index) => !findingsByIndex[index])

log(
  `Research complete: ${completedFindings.length}/${subtopics.length} structured findings available.`,
)

const synthesisInput = subtopics.map((subtopic, index) => ({
  id: subtopic.id,
  assignedSubtopic: subtopic.name,
  focus: subtopic.focus,
  finding: findingsByIndex[index],
}))

phase('Synthesize cited report')
log('Launching synthesis editor to produce one cited report covering all 42 subtopics.')

const synthesisPrompt = `
You are the synthesis editor for a research swarm.

Task:
Write one synthesized, cited report on "The History of Distributed Consensus Algorithms" using the structured findings below.

Inputs:
${JSON.stringify(
  {
    totalSubtopics: subtopics.length,
    completedFindings: completedFindings.length,
    missingSubtopics: missingSubtopics.map((s) => ({ id: s.id, name: s.name })),
    findings: synthesisInput,
  },
  null,
  2,
)}

Report requirements:
1. Cover all 42 assigned subtopics in order. If a finding is missing, include the subtopic anyway and clearly mark it as needing follow-up rather than inventing details.
2. Produce a coherent historical synthesis, not just a pasted list.
3. Include:
   - Title
   - Executive summary
   - Chronological overview/timeline
   - Thematic synthesis explaining major shifts: crash faults to Byzantine faults, synchrony assumptions, quorum methods, Paxos lineage, production systems, BFT/blockchain-era protocols, and formal verification
   - Numbered annotated coverage of all 42 subtopics
   - Bibliography or source list
4. Use citations throughout. Cite only URLs supplied in the findings. Do not invent new URLs or source titles.
5. Prefer Markdown citations, e.g. [source](https://example.com), and include source URLs near the claims they support.
6. Keep the report concise but comprehensive: roughly 3,500-5,500 words if space allows.
7. Preserve nuance: distinguish deterministic consensus from probabilistic consensus, crash-fault tolerance from Byzantine fault tolerance, and synchronous/partially synchronous/asynchronous assumptions.
8. Do not output JSON. Output the final report as readable Markdown.
`.trim()

let synthesizedReport = null
try {
  synthesizedReport = await agent(
    synthesisPrompt,
    agentOptions(
      'Synthesize cited report',
      synthesisEffort,
      synthesisModel,
      null,
    ),
  )
} catch (error) {
  log('Synthesis agent failed or budget was exhausted; producing deterministic fallback report.')
}

function makeFallbackReport() {
  const lines = []
  lines.push('# The History of Distributed Consensus Algorithms')
  lines.push('')
  lines.push(
    '_Fallback report generated from the structured research findings because the synthesis agent did not return a final report._',
  )
  lines.push('')
  lines.push('## Executive Summary')
  lines.push('')
  lines.push(
    'Distributed consensus evolved from early fault-tolerant replication, database commit, and voting schemes into a broad family of protocols spanning crash-fault-tolerant state machine replication, Byzantine agreement, production coordination services, blockchain consensus, and formally verified implementations. The findings below preserve the swarm’s structured historical coverage and cite the available source URLs supplied by each research subagent.',
  )
  lines.push('')
  lines.push('## Annotated Coverage of 42 Subtopics')
  lines.push('')

  subtopics.forEach((subtopic, index) => {
    const finding = findingsByIndex[index]
    lines.push(`### ${subtopic.id}. ${subtopic.name}`)
    lines.push('')
    if (!finding) {
      lines.push(
        `No validated finding was returned for this subtopic. Focus for follow-up: ${subtopic.focus}`,
      )
      lines.push('')
      return
    }

    const citationText =
      finding.sourceUrls.length > 0
        ? ` Sources: ${finding.sourceUrls
            .map((url) => `[${url}](${url})`)
            .join('; ')}.`
        : ' Sources: source URLs were not supplied by the research subagent.'

    finding.keyPoints.forEach((point) => {
      lines.push(`- ${point}${citationText}`)
    })
    lines.push('')
  })

  lines.push('## Source List by Subtopic')
  lines.push('')
  subtopics.forEach((subtopic, index) => {
    const finding = findingsByIndex[index]
    const urls = finding && finding.sourceUrls.length > 0 ? finding.sourceUrls : []
    lines.push(`- **${subtopic.id}. ${subtopic.name}:** ${urls.length ? urls.join('; ') : 'No source URL supplied.'}`)
  })

  return lines.join('\n')
}

const finalReport =
  typeof synthesizedReport === 'string' && synthesizedReport.trim().length > 0
    ? synthesizedReport
    : makeFallbackReport()

finalReport
```

> **Claude judge:** The script fans out all 42 agents in a single unbounded parallel() barrier with no watchdog, no per-wave commit, and no backoff on high failure rates; a single hung agent can stall the entire run indefinitely. Positives include deterministic prompts, a capped output schema, a retry phase for uncited results, and synthesis that explicitly flags missing subtopics, but the core safety-by-construction properties (bounded waves, stall detection, incremental commitment) are absent.

## With skill — rubric 97%, patterns 100%

```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Research 42 historical subtopics in distributed consensus algorithms and synthesize a cited report.',
  phases: [
    { title: 'Prepare' },
    { title: 'Research Waves' },
    { title: 'Retry' },
    { title: 'Synthesize' },
  ],
}

/*
WATCHDOG TO ARM IMMEDIATELY AFTER LAUNCHING THIS WORKFLOW FROM THE SURROUNDING AGENT:

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: distributed-consensus-history research swarm may stall silently; check journal mtime",
  prompt: "Watchdog for distributed-consensus-history research swarm: if the workflow journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); otherwise re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/

const DEFAULT_SUBTOPICS = [
  {
    key: 'early-mutual-exclusion',
    name: 'Early distributed mutual exclusion and ordering foundations',
    focus: 'Lamport-style event ordering, distributed mutual exclusion, and how these ideas set up later consensus work.',
  },
  {
    key: 'lamport-clocks-happened-before',
    name: 'Lamport clocks and the happened-before relation',
    focus: 'The 1978 logical clock model, partial ordering of events, and its influence on reasoning about replicated systems.',
  },
  {
    key: 'byzantine-generals',
    name: 'The Byzantine Generals problem',
    focus: 'The original Byzantine fault model, oral vs signed messages, and why arbitrary faults changed consensus research.',
  },
  {
    key: 'interactive-consistency',
    name: 'Interactive consistency and early Byzantine agreement',
    focus: 'Early agreement formulations in avionics and fault-tolerant computing before modern blockchain terminology.',
  },
  {
    key: 'flp-impossibility',
    name: 'The FLP impossibility result',
    focus: 'Fischer-Lynch-Paterson, asynchronous consensus impossibility with one crash fault, and its historical impact.',
  },
  {
    key: 'partial-synchrony',
    name: 'Partial synchrony and practical solvability',
    focus: 'Dwork-Lynch-Stockmeyer partial synchrony models and how they bridged theory and practical consensus.',
  },
  {
    key: 'randomized-consensus',
    name: 'Randomized consensus algorithms',
    focus: 'Ben-Or, Rabin, and the use of randomness to circumvent deterministic asynchronous impossibility limits.',
  },
  {
    key: 'failure-detectors',
    name: 'Failure detectors',
    focus: 'Chandra-Toueg unreliable failure detectors, completeness/accuracy classes, and consensus abstraction.',
  },
  {
    key: 'paxos-origins',
    name: 'Origins of Paxos',
    focus: 'Lamport’s Paxos story, Synod protocol, The Part-Time Parliament, and the delayed recognition of Paxos.',
  },
  {
    key: 'multi-paxos',
    name: 'Multi-Paxos and replicated state machines',
    focus: 'Extending single-decree Paxos to repeated log agreement and state-machine replication.',
  },
  {
    key: 'cheap-paxos-fast-paxos',
    name: 'Cheap Paxos and Fast Paxos',
    focus: 'Paxos variants aimed at reducing active replicas or communication latency.',
  },
  {
    key: 'generalized-paxos',
    name: 'Generalized Paxos and command commutativity',
    focus: 'Consensus variants that exploit non-conflicting commands and partial orders rather than total ordering every operation.',
  },
  {
    key: 'vertical-paxos-reconfiguration',
    name: 'Vertical Paxos and reconfiguration',
    focus: 'Membership changes, configuration masters, and historical evolution of reconfigurable Paxos.',
  },
  {
    key: 'viewstamped-replication',
    name: 'Viewstamped Replication',
    focus: 'Oki-Liskov Viewstamped Replication, view changes, primary-backup replication, and relation to Paxos.',
  },
  {
    key: 'vr-revisited',
    name: 'Viewstamped Replication Revisited',
    focus: 'The updated VR protocol and its role in clarifying replication protocol design.',
  },
  {
    key: 'raft',
    name: 'Raft',
    focus: 'Raft’s design for understandability, leader election, log replication, membership changes, and adoption.',
  },
  {
    key: 'zab',
    name: 'ZooKeeper Atomic Broadcast (Zab)',
    focus: 'Zab’s history in ZooKeeper, primary ordering, recovery, and relation to atomic broadcast.',
  },
  {
    key: 'virtual-synchrony',
    name: 'Virtual synchrony',
    focus: 'Isis, group communication, view changes, and the influence of virtual synchrony on replicated services.',
  },
  {
    key: 'atomic-broadcast-equivalence',
    name: 'Atomic broadcast and consensus equivalence',
    focus: 'Historical results showing equivalence between total order broadcast and consensus.',
  },
  {
    key: 'two-phase-commit',
    name: 'Two-phase commit and transaction commit',
    focus: '2PC as distributed agreement for transactions, blocking behavior, and distinction from fault-tolerant consensus.',
  },
  {
    key: 'three-phase-commit',
    name: 'Three-phase commit',
    focus: '3PC’s non-blocking goals under timing assumptions and its historical place relative to consensus.',
  },
  {
    key: 'quorum-systems',
    name: 'Quorum systems and majority voting',
    focus: 'Historical quorum intersection ideas underlying Paxos, storage replication, and fault tolerance.',
  },
  {
    key: 'dynamic-quorums-reconfiguration',
    name: 'Dynamic quorums and reconfiguration',
    focus: 'How changing replica sets, joint consensus, and quorum evolution were treated across consensus systems.',
  },
  {
    key: 'chain-replication',
    name: 'Chain replication',
    focus: 'Chain replication’s ordering, failure handling, and relationship to consensus-based state-machine replication.',
  },
  {
    key: 'primary-backup',
    name: 'Primary-backup replication history',
    focus: 'Primary-copy replication, failover, split-brain risks, and how consensus formalized safe leader changes.',
  },
  {
    key: 'cap-theorem',
    name: 'CAP theorem and consensus',
    focus: 'CAP’s historical framing, partitions, consistency/availability tradeoffs, and its interaction with consensus protocols.',
  },
  {
    key: 'linearizability',
    name: 'Linearizability and consensus',
    focus: 'Linearizability as a correctness condition and its relationship to consensus-backed replicated objects.',
  },
  {
    key: 'state-machine-replication',
    name: 'State-machine replication',
    focus: 'The historical abstraction of deterministic replicated state machines driven by ordered commands.',
  },
  {
    key: 'pbft',
    name: 'Practical Byzantine Fault Tolerance',
    focus: 'Castro-Liskov PBFT, practical BFT state-machine replication, phases, and impact.',
  },
  {
    key: 'bft-smr-after-pbft',
    name: 'BFT state-machine replication after PBFT',
    focus: 'Zyzzyva, HQ, Aardvark, and later attempts to improve practical Byzantine consensus.',
  },
  {
    key: 'tendermint',
    name: 'Tendermint consensus',
    focus: 'BFT consensus for proof-of-stake blockchains, proposer/vote rounds, finality, and Cosmos adoption.',
  },
  {
    key: 'hotstuff',
    name: 'HotStuff',
    focus: 'HotStuff’s linear communication, chained commits, pacemakers, and influence on Libra/Diem and later BFT protocols.',
  },
  {
    key: 'bitcoin-nakamoto-consensus',
    name: 'Bitcoin and Nakamoto consensus',
    focus: 'Proof-of-work longest-chain consensus, probabilistic finality, and departure from classical consensus models.',
  },
  {
    key: 'proof-of-stake-history',
    name: 'Proof-of-stake consensus history',
    focus: 'Early PoS proposals through modern BFT/chain-based PoS systems and their historical motivations.',
  },
  {
    key: 'ethereum-casper-gasper',
    name: 'Ethereum Casper and Gasper',
    focus: 'Ethereum’s path from proof-of-work to proof-of-stake, Casper FFG, LMD-GHOST, and Gasper.',
  },
  {
    key: 'avalanche-consensus',
    name: 'Avalanche family consensus',
    focus: 'Avalanche/Snow protocols, metastability, repeated sampling, and historical position among consensus designs.',
  },
  {
    key: 'hashgraph',
    name: 'Hashgraph and gossip-about-gossip',
    focus: 'Hashgraph’s virtual voting, gossip history, asynchronous BFT claims, and adoption context.',
  },
  {
    key: 'crdt-consensus-boundary',
    name: 'CRDTs and the boundary of consensus',
    focus: 'Conflict-free replicated data types, eventual consistency, and when systems avoid consensus by design.',
  },
  {
    key: 'consensus-in-databases',
    name: 'Consensus in distributed databases',
    focus: 'Use of Paxos/Raft-like consensus in systems such as Spanner, CockroachDB, etcd, and distributed SQL.',
  },
  {
    key: 'consensus-in-configuration-services',
    name: 'Consensus in configuration and coordination services',
    focus: 'Chubby, ZooKeeper, etcd, Consul, and the operational history of consensus as infrastructure.',
  },
  {
    key: 'formal-verification-consensus',
    name: 'Formal verification of consensus protocols',
    focus: 'TLA+, model checking, mechanized proofs, and the history of finding bugs in consensus designs.',
  },
  {
    key: 'modern-open-problems',
    name: 'Modern open problems and evolving directions',
    focus: 'Scalability, reconfiguration, latency, BFT performance, leaderless designs, and emerging research directions.',
  },
]

const INPUT_SUBTOPICS =
  Array.isArray(args?.subtopics) && args.subtopics.length
    ? args.subtopics.map((it, i) => ({
        key: String(it.key ?? `custom-${String(i + 1).padStart(2, '0')}`),
        name: String(it.name ?? it.title ?? it.key ?? `Custom subtopic ${i + 1}`),
        focus: String(it.focus ?? it.description ?? it.name ?? it.title ?? ''),
      }))
    : DEFAULT_SUBTOPICS

const SUBTOPICS = INPUT_SUBTOPICS.slice(0, 42)

const WAVE_SIZE = Number.isInteger(args?.waveSize) && args.waveSize >= 1 && args.waveSize <= 8 ? args.waveSize : 6
const MAX_RETRY_ITEMS = Number.isInteger(args?.maxRetryItems) && args.maxRetryItems >= 0 ? args.maxRetryItems : 42

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const RESEARCH_FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'name', 'keyPoints', 'sourceUrls'],
  properties: {
    key: {
      type: 'string',
      description: 'Stable subtopic key supplied in the prompt.',
    },
    name: {
      type: 'string',
      description: 'Human-readable subtopic name supplied in the prompt.',
    },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'string',
        maxLength: 320,
      },
      description: 'Exactly three concise, historically grounded key points.',
    },
    sourceUrls: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'string',
      },
      description: 'Up to three authoritative source URLs. Prefer papers, official project docs, or reputable historical references.',
    },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'coverageSummary', 'reportMarkdown', 'gaps'],
  properties: {
    title: {
      type: 'string',
    },
    coverageSummary: {
      type: 'string',
      description: 'Brief statement of how many subtopics were covered and any limitations.',
    },
    reportMarkdown: {
      type: 'string',
      description: 'A synthesized, cited Markdown report covering all available subtopics. Use inline citations as URLs in parentheses.',
    },
    gaps: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Missing or thinly evidenced subtopics, if any.',
    },
  },
}

function researchPrompt(topic) {
  return [
    `You are a precise research subagent in a swarm studying the history of distributed consensus algorithms.`,
    ``,
    `Research exactly this subtopic:`,
    `key: ${topic.key}`,
    `name: ${topic.name}`,
    `focus: ${topic.focus}`,
    ``,
    `Return ONLY data matching the schema.`,
    `Requirements:`,
    `- Use the supplied key and name exactly.`,
    `- Provide exactly 3 keyPoints.`,
    `- Each key point must be historically specific: include dates, papers, people, systems, or protocol relationships where relevant.`,
    `- Include 1 to 3 sourceUrls. Prefer original papers, official documentation, ACM/IEEE pages, university PDFs, RFCs, or project documentation.`,
    `- Keep output lean. No long quotations. No uncited broad claims.`,
  ].join('\n')
}

function runResearchAgent(topic) {
  return agent(researchPrompt(topic), {
    label: `research:${topic.key}`,
    phase: 'Research Waves',
    schema: RESEARCH_FINDING_SCHEMA,
    effort: 'medium',
  })
}

phase('Prepare')
log(`Preparing research swarm for ${SUBTOPICS.length} distributed-consensus-history subtopics.`)
log(`Using wave size ${WAVE_SIZE}; completed worker calls are resume-cacheable because prompts are stable.`)
log(`IMPORTANT: arm the ScheduleWakeup watchdog shown in the script comments immediately after launch.`)

const waves = chunk(SUBTOPICS, WAVE_SIZE)
const done = []
let failed = []
let stoppedForInstability = false
let notYetLaunched = []

phase('Research Waves')
for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  phase(`Research Wave ${w + 1}/${waves.length}`)
  log(`Starting research wave ${w + 1}/${waves.length}: ${wave.map(t => t.key).join(', ')}`)

  const batch = await parallel(wave.map(topic => () => runResearchAgent(topic)))

  let nulls = 0
  batch.forEach((result, i) => {
    if (result) {
      done.push(result)
    } else {
      nulls += 1
      failed.push(wave[i])
    }
  })

  log(`Finished wave ${w + 1}/${waves.length}: ${batch.length - nulls}/${batch.length} succeeded; cumulative ${done.length}/${SUBTOPICS.length} succeeded; ${failed.length} failed so far.`)

  if (nulls / batch.length > 0.4) {
    stoppedForInstability = true
    notYetLaunched = waves.slice(w + 1).flat()
    failed = failed.concat(notYetLaunched)
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Stopping new waves and returning partial synthesis; resume later to recover cheaply from cache.`)
    break
  }
}

const uniqueByKey = new Map()
for (const finding of done) {
  if (finding && finding.key && !uniqueByKey.has(finding.key)) uniqueByKey.set(finding.key, finding)
}
done.length = 0
done.push(...uniqueByKey.values())

if (failed.length && !stoppedForInstability) {
  phase('Retry')
  const retryItems = failed.slice(0, MAX_RETRY_ITEMS)
  const deferredRetryItems = failed.slice(MAX_RETRY_ITEMS)

  log(`Starting one retry wave over ${retryItems.length} failed items after natural backoff from primary waves.`)

  const retried = await parallel(retryItems.map(topic => () => runResearchAgent(topic)))

  const stillFailed = []
  retried.forEach((result, i) => {
    if (result) {
      if (!uniqueByKey.has(result.key)) {
        uniqueByKey.set(result.key, result)
        done.push(result)
      }
    } else {
      stillFailed.push(retryItems[i])
    }
  })

  failed = stillFailed.concat(deferredRetryItems)
  log(`Retry recovered ${retried.filter(Boolean).length}/${retryItems.length}; still missing ${failed.length}.`)
}

const haveKeys = new Set(done.map(r => r.key))
const missing = SUBTOPICS.filter(topic => !haveKeys.has(topic.key)).map(topic => ({
  key: topic.key,
  name: topic.name,
  focus: topic.focus,
}))

if (missing.length) {
  log(`⚠ partial coverage: missing ${missing.length}/${SUBTOPICS.length} subtopics: ${missing.map(m => m.key).join(', ')}`)
} else {
  log(`Full coverage achieved for all ${SUBTOPICS.length} subtopics.`)
}

const sortedFindings = [...done].sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))
const sortedMissing = [...missing].sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))

phase('Synthesize')
const synthesisInput = JSON.stringify(
  {
    topic: 'the history of distributed consensus algorithms',
    totalPlannedSubtopics: SUBTOPICS.length,
    coveredSubtopics: sortedFindings.length,
    missingSubtopics: sortedMissing,
    findings: sortedFindings,
  },
  null,
  2
)

const synthesis = await agent(
  [
    `You are the synthesis agent for a research swarm on the history of distributed consensus algorithms.`,
    ``,
    `Using ONLY the structured findings below, produce one coherent, cited Markdown report.`,
    ``,
    `Report requirements:`,
    `- Cover the chronology from early ordering/fault-tolerance theory through Paxos/Viewstamped Replication/Raft, BFT, blockchain-era consensus, and modern directions.`,
    `- Cite claims using inline source URLs in parentheses. Use the sourceUrls provided in the findings.`,
    `- Mention all covered subtopics at least once, integrating them into a narrative rather than listing 42 disconnected blurbs.`,
    `- If any subtopics are missing, explicitly flag them in the gaps field and in a short "Coverage gaps" section.`,
    `- Do not invent citations or sources not present in the findings.`,
    `- Keep the report substantial but concise enough to be useful.`,
    ``,
    `Structured findings and missing-subtopic list:`,
    synthesisInput,
  ].join('\n'),
  {
    label: 'synthesize:cited-report',
    phase: 'Synthesize',
    schema: SYNTHESIS_SCHEMA,
    effort: 'high',
  }
)

return {
  plannedSubtopics: SUBTOPICS,
  findings: sortedFindings,
  missing: sortedMissing,
  stoppedForInstability,
  synthesis,
  operationalNotes: {
    watchdog: 'Arm the ScheduleWakeup watchdog from the script comment after launch; on stall, TaskStop then resume with Workflow({scriptPath, resumeFromRunId}).',
    extraction: 'For full raw results, parse the workflow journal.jsonl with Python rather than relying on any truncated .output file.',
    resume: 'Research prompts are stable by subtopic key; completed findings should be cached on resume. The synthesis prompt embeds findings and missing lists so it re-runs when coverage improves.',
  },
}
```

> **Claude judge:** All eight safety properties are present: bounded 6-item waves with sequential dispatch, per-wave null-tolerance and a dedicated retry pass, per-wave result commitment before synthesis, a prominently documented ScheduleWakeup watchdog (correctly placed as an instruction to the surrounding agent), deterministic cache-stable prompts, strictly capped output schemas, synthesis that accepts partial findings and explicitly flags gaps, and a >40% failure-rate backoff that halts further waves and returns partial results.

