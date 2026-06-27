# research-swarm — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 15%, patterns 25%

````js
```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Researches 42 subtopics of the history of distributed consensus algorithms, then synthesizes a cited report.',
  phases: [
    { title: 'Subtopic Selection' },
    { title: 'Research Subtopics' },
    { title: 'Synthesize Report' }
  ]
}

// --- Phase 1: Subtopic Selection ---
phase('Subtopic Selection')
log('Selecting 42 distinct subtopics related to the history of distributed consensus algorithms.')

const subtopics = await agent(
  `List 42 distinct, non-overlapping subtopics that together comprehensively cover the history of distributed consensus algorithms. 
Each subtopic should be specific (e.g., "Paxos algorithm origins", "Byzantine Generals Problem", "Blockchain consensus evolution", etc.), 
and collectively they should span foundational concepts, key algorithms, historical milestones, major papers, practical deployments, and recent developments. 
Return as an array of objects: [{ "title": string, "brief": string }].`,
  {
    label: 'Generate 42 Subtopics',
    schema: {
      type: 'array',
      minItems: 42,
      maxItems: 42,
      items: {
        type: 'object',
        required: ['title', 'brief'],
        properties: {
          title: { type: 'string', minLength: 5 },
          brief: { type: 'string', minLength: 15 }
        }
      }
    }
  }
)

if (!subtopics || subtopics.length !== 42) {
  throw new Error('Failed to generate 42 subtopics. Aborting.')
}

// --- Phase 2: Research Subtopics ---
phase('Research Subtopics')
log('Launching 42 subagents to research each subtopic.')

const researchResults = await parallel(
  subtopics.map((sub, idx) => async () => {
    return await agent(
      `Research the following subtopic related to the history of distributed consensus algorithms:

Title: ${sub.title}
Brief: ${sub.brief}

Return a structured finding as a JSON object with:
- "name": the subtopic title,
- "keyPoints": an array of 3 concise, important points about this subtopic (each 1-2 sentences),
- "sources": up to 3 reputable URLs (papers, articles, or documentation) that support your points.

Format:
{
  "name": "...",
  "keyPoints": ["...", "...", "..."],
  "sources": ["...", "...", "..."]
}

If you cannot find sources, leave the "sources" array empty.`,
      {
        label: `Research: ${sub.title}`,
        phase: 'Research Subtopics',
        schema: {
          type: 'object',
          required: ['name', 'keyPoints', 'sources'],
          properties: {
            name: { type: 'string', minLength: 5 },
            keyPoints: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: { type: 'string', minLength: 10 }
            },
            sources: {
              type: 'array',
              minItems: 0,
              maxItems: 3,
              items: { type: 'string', pattern: '^https?://' }
            }
          }
        }
      }
    )
  })
)

// Filter out any failed/null results
const validFindings = researchResults.filter(Boolean)
if (validFindings.length < 35) {
  throw new Error('Too many subtopic research failures. Aborting.')
}

// --- Phase 3: Synthesize Report ---
phase('Synthesize Report')
log('Synthesizing a comprehensive, cited report from all subtopic findings.')

const synthesizedReport = await agent(
  `You are to synthesize a comprehensive, well-structured report on "The History of Distributed Consensus Algorithms" using the following 42 subtopic findings.

For each subtopic, you have:
- name: the subtopic title
- keyPoints: 3 key points (each 1-2 sentences)
- sources: up to 3 URLs

Instructions:
- Organize the report into logical sections (chronological, thematic, or by algorithm family).
- For each subtopic, summarize its key points in your own words, integrating them smoothly into the narrative.
- Where appropriate, cite sources inline as [n] and provide a numbered reference list at the end, mapping [n] to the URLs.
- Ensure the report is readable, cohesive, and covers all subtopics.
- Begin with a brief introduction and end with a conclusion on the evolution and impact of distributed consensus algorithms.

Here are the findings (JSON array):
${JSON.stringify(validFindings, null, 2)}

Return ONLY the full report as markdown, including inline citations and the reference list.`,
  {
    label: 'Synthesize Cited Report',
    phase: 'Synthesize Report
````

> **GPT-5.5 judge:** The workflow uses a single unbounded parallel() fan-out across all 42 subagents, with no bounded waves, no ScheduleWakeup/stall watchdog, no per-agent retry wrapper, no per-wave commits, no resume/cache-stable prompts, and no high-failure-rate backoff. It does apply lean schemas with capped outputs and has minimal null filtering plus an abort if fewer than 35 findings succeed, but this still allows completed work to be silently omitted from synthesis and does not explicitly flag gaps. Overall it is not safe-by-construction for large parallel fan-out and is vulnerable to a hung connection deadlocking the run or losing partial work.

## With skill — rubric 12%, patterns 19%

````js
```js
export const meta = {
  name: 'distributed-consensus-history-swarm',
  description: 'Researches 42 subtopics of distributed consensus algorithms history, then synthesizes a cited report.',
  phases: [
    { title: 'Research Swarm' },
    { title: 'Synthesis' }
  ]
}

// --- CONFIGURATION ---

// 42 distinct subtopics (example list; replace or expand as needed)
const SUBTOPICS = [
  { key: 'byzantine-generals', name: 'Byzantine Generals Problem' },
  { key: 'paxos', name: 'Paxos Algorithm' },
  { key: 'raft', name: 'Raft Consensus Algorithm' },
  { key: 'viewstamped-replication', name: 'Viewstamped Replication' },
  { key: 'pbft', name: 'Practical Byzantine Fault Tolerance (PBFT)' },
  { key: 'zab', name: 'Zookeeper Atomic Broadcast (ZAB)' },
  { key: 'tendermint', name: 'Tendermint' },
  { key: 'hotstuff', name: 'HotStuff' },
  { key: 'casper', name: 'Casper (Ethereum)' },
  { key: 'snowball', name: 'Avalanche/Snowball' },
  { key: 'chubby', name: 'Chubby Lock Service' },
  { key: 'etcd', name: 'etcd' },
  { key: 'consul', name: 'Consul' },
  { key: 'epaxos', name: 'EPaxos' },
  { key: 'multi-paxos', name: 'Multi-Paxos' },
  { key: 'fast-paxos', name: 'Fast Paxos' },
  { key: 'cheap-paxos', name: 'Cheap Paxos' },
  { key: 'vertical-paxos', name: 'Vertical Paxos' },
  { key: 'lamport-timestamps', name: 'Lamport Timestamps' },
  { key: 'vector-clocks', name: 'Vector Clocks' },
  { key: 'gossip-protocols', name: 'Gossip Protocols' },
  { key: 'blockchain', name: 'Blockchain Consensus' },
  { key: 'proof-of-work', name: 'Proof of Work' },
  { key: 'proof-of-stake', name: 'Proof of Stake' },
  { key: 'delegated-proof-of-stake', name: 'Delegated Proof of Stake' },
  { key: 'tangle', name: 'IOTA Tangle' },
  { key: 'algorand', name: 'Algorand' },
  { key: 'honeybadger', name: 'HoneyBadgerBFT' },
  { key: 'stellar-consensus', name: 'Stellar Consensus Protocol' },
  { key: 'tendermint-bft', name: 'Tendermint BFT' },
  { key: 'quorum', name: 'Quorum' },
  { key: 'chain-replication', name: 'Chain Replication' },
  { key: 'raft-vs-paxos', name: 'Raft vs Paxos' },
  { key: 'consensus-in-db', name: 'Consensus in Distributed Databases' },
  { key: 'consensus-in-blockchains', name: 'Consensus in Blockchains' },
  { key: 'consensus-in-wireless', name: 'Consensus in Wireless Networks' },
  { key: 'consensus-in-iot', name: 'Consensus in IoT' },
  { key: 'consensus-in-ml', name: 'Consensus in Distributed Machine Learning' },
  { key: 'consensus-in-robotics', name: 'Consensus in Robotics' },
  { key: 'consensus-in-multiagent', name: 'Consensus in Multi-Agent Systems' },
  { key: 'consensus-failures', name: 'Notable Consensus Failures' },
  { key: 'future-directions', name: 'Future Directions in Consensus Research' }
]

// Output schema for each subagent
const FINDING_SCHEMA = {
  type: 'object',
  required: ['subtopicKey', 'subtopicName', 'summaryPoints', 'sources'],
  properties: {
    subtopicKey: { type: 'string', description: 'Stable key for the subtopic' },
    subtopicName: { type: 'string', description: 'Human-readable subtopic name' },
    summaryPoints: {
      type: 'array',
      items: { type: 'string', maxLength: 300 },
      minItems: 1,
      maxItems: 3,
      description: 'Up to 3 concise, key historical points about this
````

> **GPT-5.5 judge:** The shown workflow mainly defines 42 subtopics and a capped finding schema, which helps keep outputs lean. However, it does not demonstrate bounded wave execution, per-agent retry/null tolerance, per-wave result commits, a ScheduleWakeup stall watchdog, resume/cache-stable prompts, partial-input synthesis with explicit gap reporting, or failure-rate backoff. There is also no visible protection against a hung subagent deadlocking the run or against losing completed work. Because the orchestration logic is absent/truncated, it meets only a small fraction of the safety bar.

