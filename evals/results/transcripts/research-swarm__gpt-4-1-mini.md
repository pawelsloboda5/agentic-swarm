# research-swarm — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 15%, patterns 13%

````js
```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Research 42 distinct subtopics on the history of distributed consensus algorithms and synthesize a comprehensive cited report.',
  phases: [
    { title: 'Research Subtopics' },
    { title: 'Synthesize Report' },
  ],
}

const subtopicPrompt = (subtopic) => `
You are an expert researcher on distributed consensus algorithms. Research the following subtopic in the history of distributed consensus algorithms:

"${subtopic}"

Return a JSON object with the following fields:
- name: The canonical name/title of this subtopic.
- keyPoints: An array of exactly 3 concise key points summarizing the subtopic.
- sources: An array of up to 3 URLs to reputable sources (papers, articles, or official docs) that support the key points.

Respond ONLY with the JSON object, no extra commentary.
`

const synthesizePrompt = (findings) => `
You are an expert technical writer tasked with synthesizing a comprehensive, well-structured report on the history of distributed consensus algorithms.

You have research findings on 42 distinct subtopics. Each finding includes:
- name: the subtopic name
- keyPoints: 3 key points
- sources: up to 3 source URLs

Write a detailed report that:
- Covers all 42 subtopics clearly and cohesively.
- Integrates the key points from each subtopic.
- Cites sources inline by number, e.g. [1], [2], etc.
- Includes a numbered references section listing all unique URLs cited.

Format the report in markdown. The report should be suitable for a technical audience interested in distributed consensus history.

Here are the findings:

${findings.map((f, i) => `### ${i+1}. ${f.name}
- ${f.keyPoints.map(p => `- ${p}`).join('\n- ')}
- Sources: ${f.sources.length ? f.sources.map((s, j) => `[${i*3+j+1}](${s})`).join(', ') : 'None'}
`).join('\n')}

Begin the report now.
`

// 42 distinct subtopics on the history of distributed consensus algorithms
// These are example subtopics to guide the research agents.
const subtopics = [
  "Early consensus protocols before Paxos",
  "Leslie Lamport's Paxos algorithm",
  "Practical Byzantine Fault Tolerance (PBFT)",
  "Raft consensus algorithm",
  "Viewstamped Replication",
  "Two-phase commit protocol",
  "Three-phase commit protocol",
  "Byzantine Generals Problem",
  "Consensus in blockchain systems",
  "Proof-of-Work consensus",
  "Proof-of-Stake consensus",
  "Federated consensus models",
  "Consensus in distributed databases",
  "Consensus in distributed ledgers",
  "Consensus in sensor networks",
  "Consensus in peer-to-peer networks",
  "Consensus in cloud computing",
  "Consensus in distributed file systems",
  "Consensus in multi-agent systems",
  "Consensus in distributed AI systems",
  "Consensus under network partitions",
  "Consensus with crash faults",
  "Consensus with Byzantine faults",
  "Consensus in asynchronous systems",
  "Consensus in partially synchronous systems",
  "Consensus in synchronous systems",
  "Consensus and CAP theorem",
  "Consensus and FLP impossibility",
  "Consensus and eventual consistency",
  "Consensus and linearizability",
  "Consensus and state machine replication",
  "Consensus and leader election",
  "Consensus and quorum systems",
  "Consensus and gossip protocols",
  "Consensus and failure detectors",
  "Consensus and blockchain forks",
  "Consensus and sharding",
  "Consensus and scalability",
  "Consensus and security attacks",
  "Consensus and cryptographic techniques",
  "Consensus and formal verification",
  "Consensus and real-world deployments",
]

phase('Research Subtopics')

// Research each subtopic in parallel with a dedicated subagent
const researchResults = await parallel(
  subtopics.map((subtopic, i) => async () => {
    // Use a schema to validate the structured JSON response
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        keyPoints: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 3,
        },
        sources: {
          type: 'array',
          items: { type: 'string', format: 'uri' },
          maxItems: 3,
        },
      },
      required: ['name', 'keyPoints', 'sources'],
      additionalProperties: false,
    }
    const prompt = subtopicPrompt(subtopic)
    const result = await agent(prompt, { schema, label: `Research subtopic #${i+1}`, phase: 'Research Subtopics', effort: 'high' })
    return result
  })
)

// Filter
````

> **GPT-5.5 judge:** The workflow uses a single unbounded parallel() fan-out over all 42 subagents, creating a hard barrier where one hung or failed connection can stall the whole run. It has no ScheduleWakeup watchdog, no bounded waves, no per-agent retry/null-tolerance, no per-wave commits, no backoff on high failure rate, and no resume/cache-stable persistence. The schema and prompts do cap outputs reasonably, which earns limited credit, but synthesis appears to expect complete input rather than tolerating partial results or flagging gaps. Overall it is not safe-by-construction for a large parallel-subagent fan-out.

## With skill — rubric 25%, patterns 25%

````js
```js
export const meta = {
  name: 'distributed-consensus-history-swarm',
  description: 'Research 42 subtopics of the history of distributed consensus algorithms and synthesize a cited report',
  phases: [
    { title: 'Research' },
    { title: 'Retry Failed' },
    { title: 'Synthesize' },
  ],
}

const SUBTOPICS = [
  { key: 'paxos', name: 'Paxos Algorithm' },
  { key: 'raft', name: 'Raft Consensus Algorithm' },
  { key: 'two-phase-commit', name: 'Two-Phase Commit Protocol' },
  { key: 'three-phase-commit', name: 'Three-Phase Commit Protocol' },
  { key: 'byzantine-fault-tolerance', name: 'Byzantine Fault Tolerance' },
  { key: 'fischer-lynch-patterson', name: 'Fischer-Lynch-Patterson Impossibility Result' },
  { key: 'lamport-timestamps', name: 'Lamport Timestamps' },
  { key: 'chandra-toueg', name: 'Chandra-Toueg Consensus Algorithm' },
  { key: 'viewstamped-replication', name: 'Viewstamped Replication' },
  { key: 'virtual-synchronous', name: 'Virtual Synchrony Model' },
  { key: 'consensus-number', name: 'Consensus Number and Wait-Free Synchronization' },
  { key: 'federated-consensus', name: 'Federated Consensus' },
  { key: 'blockchain-consensus', name: 'Blockchain Consensus Protocols' },
  { key: 'proof-of-work', name: 'Proof of Work' },
  { key: 'proof-of-stake', name: 'Proof of Stake' },
  { key: 'delegated-proof-of-stake', name: 'Delegated Proof of Stake' },
  { key: 'practical-byzantine-fault-tolerance', name: 'Practical Byzantine Fault Tolerance (PBFT)' },
  { key: 'gossip-protocols', name: 'Gossip Protocols' },
  { key: 'epaxos', name: 'EPaxos' },
  { key: 'fast-paxos', name: 'Fast Paxos' },
  { key: 'zab-protocol', name: 'Zab Protocol' },
  { key: 'chain-replication', name: 'Chain Replication' },
  { key: 'atomic-broadcast', name: 'Atomic Broadcast' },
  { key: 'consensus-in-blockchains', name: 'Consensus in Permissioned Blockchains' },
  { key: 'leader-election', name: 'Leader Election Algorithms' },
  { key: 'consensus-in-wireless-networks', name: 'Consensus in Wireless Networks' },
  { key: 'consensus-in-distributed-databases', name: 'Consensus in Distributed Databases' },
  { key: 'consensus-in-cloud-systems', name: 'Consensus in Cloud Systems' },
  { key: 'consensus-in-multi-agent-systems', name: 'Consensus in Multi-Agent Systems' },
  { key: 'consensus-in-robotics', name: 'Consensus in Robotics' },
  { key: 'consensus-in-peer-to-peer', name: 'Consensus in Peer-to-Peer Systems' },
  { key: 'consensus-in-iot', name: 'Consensus in Internet of Things (IoT)' },
  { key: 'consensus-in-edge-computing', name: 'Consensus in Edge Computing' },
  { key: 'consensus-in-financial-systems', name: 'Consensus in Financial Systems' },
  { key: 'consensus-in-telecommunications', name: 'Consensus in Telecommunications' },
  { key: 'consensus-in-social-networks', name: 'Consensus in Social Networks' },
  { key: 'consensus-in-ai-systems', name: 'Consensus in AI Systems' },
  { key: 'consensus-in-quantum-computing', name: 'Consensus in Quantum Computing' },
  { key: 'consensus-in-hpc', name: 'Consensus in High Performance Computing' },
  { key: 'consensus-in-distributed-ledgers', name: 'Consensus in Distributed Ledgers' },
  { key: 'consensus-in-smart-contracts', name: 'Consensus in Smart Contracts' },
]

const WAVE_SIZE = 7

// Schema for each subagent's research result
const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    name: { type: 'string' },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
````

> **GPT-5.5 judge:** The script shows a bounded wave size of 7, which is good for avoiding one giant fan-out, and it begins defining a lean/capped research schema. It also has a 'Retry Failed' phase, but the visible code does not demonstrate per-agent retry/null-tolerance, per-wave result commits, a ScheduleWakeup stall watchdog, resume/cache-stable prompts, partial-input synthesis with explicit gap reporting, or backing off on high wave failure rates. The output is also truncated before the actual orchestration logic, so the most important safety mechanisms cannot be verified.

