# research-swarm — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a RESEARCH SWARM: research 42 distinct subtopics of "the history of distributed consensus algorithms". One subagent researches each subtopic and returns a structured finding (name, 3 key points, up to 3 source URLs). Then produce one synthesized, cited report covering all subtopics.

---

## Baseline (no skill) — rubric 20%, patterns 25%

```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Researches 42 subtopics on the history of distributed consensus algorithms, then synthesizes a cited report.',
  phases: [
    { title: 'Subtopic Selection' },
    { title: 'Research Swarm' },
    { title: 'Synthesis' }
  ]
}

// --- Script body starts here ---

// 1. Generate 42 distinct subtopics
phase('Subtopic Selection')
log('Generating 42 distinct subtopics on the history of distributed consensus algorithms...')
const subtopics = await agent(
  `List 42 distinct, non-overlapping subtopics that together comprehensively cover the history of distributed consensus algorithms. 
Each subtopic should be specific (e.g., "Paxos algorithm origins", "Byzantine Fault Tolerance in the 1980s", "Blockchain consensus mechanisms", etc.), and collectively they should span the field's evolution, key breakthroughs, notable algorithms, theoretical advances, practical deployments, and major controversies. 
Return as an array of strings, each a subtopic title.`,
  {
    label: 'Generate 42 subtopics',
    phase: 'Subtopic Selection',
    schema: {
      type: 'array',
      minItems: 42,
      maxItems: 42,
      items: { type: 'string', minLength: 5 }
    }
  }
)

if (!subtopics || subtopics.length !== 42) {
  throw new Error('Failed to generate 42 subtopics.')
}

// 2. Research each subtopic in parallel
phase('Research Swarm')
log('Launching research swarm: one agent per subtopic...')

const researchSchema = {
  type: 'object',
  required: ['name', 'keyPoints', 'sources'],
  properties: {
    name: { type: 'string', minLength: 5 },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'string', minLength: 20 }
    },
    sources: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'string', pattern: '^https?://' }
    }
  }
}

const researchResults = await parallel(
  subtopics.map((subtopic, idx) => async () => {
    return await agent(
      `Research the following subtopic of the history of distributed consensus algorithms: "${subtopic}".
Return a structured finding as a JSON object with:
- "name": the subtopic name,
- "keyPoints": an array of 3 concise, important points about this subtopic (each 1-3 sentences, factual, focused on historical significance, technical advances, or impact),
- "sources": up to 3 reputable source URLs (papers, articles, or documentation) that support your key points.
Do not include any commentary or explanation outside the JSON object.`,
      {
        label: `Research: ${subtopic}`,
        phase: 'Research Swarm',
        schema: researchSchema,
        effort: 'medium'
      }
    )
  })
)

// Filter out any failed/null results
const validFindings = researchResults.filter(Boolean)
if (validFindings.length < 40) {
  throw new Error(`Too many research agents failed: only ${validFindings.length} of 42 succeeded.`)
}

// 3. Synthesize a cited report
phase('Synthesis')
log('Synthesizing a comprehensive, cited report from all findings...')

const synthesizedReport = await agent(
  `You are to synthesize a comprehensive, well-structured report on "The History of Distributed Consensus Algorithms" using the following 42 structured research findings (each with name, 3 key points, and up to 3 source URLs). 
Instructions:
- Organize the report into logical sections or a chronological narrative, grouping related subtopics where appropriate.
- For each subtopic, concisely summarize its key points, integrating them smoothly into the narrative.
- Use in-text citations (e.g., [1], [2]) referencing a numbered bibliography at the end, which lists all unique source URLs.
- The report should be clear, scholarly, and suitable for a technical audience.
- Do not omit any subtopic; ensure all 42 are covered.
- At the end, include a numbered bibliography of all cited URLs.
Here are the findings (as a JSON array):\n\n${JSON.stringify(validFindings, null, 2)}
Return only the full report as markdown, including the bibliography.`,
  {
    label: 'Synthesize cited report',
    phase: 'Synthesis',
    effort: 'high',
    model: 'claude-3-opus-20240229'
  }
)

return {
  subtopics,
  findings: validFindings,
  report: synthesizedReport
}
```

> **Claude judge:** The script fans out all 42 agents in a single `parallel()` call (no bounded waves of 6-8), has no ScheduleWakeup watchdog, no per-agent retry logic, no per-wave result commits, no backoff on high failure rates, and the synthesis agent does not explicitly flag gaps. It does have a null-filter and a minimum-success threshold (40/42), lean capped schemas, and deterministic (cache-stable) prompts, which are partial mitigations, but the core safety-by-construction properties are largely absent.

## With skill — rubric 92%, patterns 100%

```js
export const meta = {
  name: 'distributed-consensus-history-research-swarm',
  description: 'Researches 42 subtopics of distributed consensus algorithms history, then synthesizes a cited report.',
  phases: [
    { title: 'Research Swarm' },
    { title: 'Synthesis' }
  ]
}

// --- CONFIGURATION ---

// 42 distinct subtopics of the history of distributed consensus algorithms
const SUBTOPICS = [
  { key: "Byzantine Generals Problem", label: "The origin and formulation of the Byzantine Generals Problem" },
  { key: "Paxos", label: "The invention and evolution of the Paxos algorithm" },
  { key: "Raft", label: "The development and adoption of the Raft consensus algorithm" },
  { key: "Viewstamped Replication", label: "The history of Viewstamped Replication" },
  { key: "Quorum Systems", label: "The role of quorum systems in consensus" },
  { key: "Lamport Timestamps", label: "The introduction of Lamport timestamps and logical clocks" },
  { key: "Vector Clocks", label: "The development of vector clocks" },
  { key: "CAP Theorem", label: "The impact of the CAP theorem on consensus research" },
  { key: "FLP Impossibility", label: "The FLP impossibility result and its implications" },
  { key: "Blockchain Consensus", label: "The emergence of blockchain-based consensus (e.g., Nakamoto consensus)" },
  { key: "Proof of Work", label: "The history and adoption of Proof of Work" },
  { key: "Proof of Stake", label: "The development of Proof of Stake and its variants" },
  { key: "PBFT", label: "The creation and influence of Practical Byzantine Fault Tolerance (PBFT)" },
  { key: "Tendermint", label: "The design and adoption of Tendermint consensus" },
  { key: "HotStuff", label: "The HotStuff protocol and its impact" },
  { key: "Leader Election", label: "The evolution of leader election in consensus protocols" },
  { key: "Distributed Commit", label: "The history of two-phase and three-phase commit protocols" },
  { key: "Gossip Protocols", label: "The use of gossip protocols in consensus" },
  { key: "State Machine Replication", label: "The concept and history of state machine replication" },
  { key: "Consensus in Wireless Networks", label: "Consensus challenges in wireless and mobile networks" },
  { key: "Consensus in Peer-to-Peer Systems", label: "Consensus in P2P and decentralized systems" },
  { key: "Federated Consensus", label: "The development of federated consensus (e.g., Stellar)" },
  { key: "Sharding and Consensus", label: "Sharding and its interaction with consensus protocols" },
  { key: "Consensus in Permissioned Blockchains", label: "Consensus in permissioned (private) blockchains" },
  { key: "Crash Fault Tolerance", label: "Crash fault tolerance vs. Byzantine fault tolerance" },
  { key: "Consensus in Databases", label: "Consensus protocols in distributed databases" },
  { key: "Consensus in Cloud Computing", label: "Consensus in cloud-native and geo-distributed systems" },
  { key: "Hybrid Consensus", label: "Hybrid consensus protocols and their motivations" },
  { key: "Consensus Scalability", label: "Scalability challenges in consensus algorithms" },
  { key: "Consensus in IoT", label: "Consensus in Internet of Things (IoT) environments" },
  { key: "Consensus in Edge Computing", label: "Consensus at the edge: challenges and solutions" },
  { key: "Asynchronous Consensus", label: "Asynchronous vs. synchronous consensus protocols" },
  { key: "Randomized Consensus", label: "Randomized algorithms for consensus" },
  { key: "Consensus in Adversarial Environments", label: "Consensus under adversarial conditions" },
  { key: "Energy-Efficient Consensus", label: "Energy efficiency in consensus protocols" },
  { key: "Consensus in Multi-Agent Systems", label: "Consensus in robotics and multi-agent systems" },
  { key: "Consensus in Financial Systems", label: "Consensus in distributed financial ledgers" },
  { key: "Consensus in AI/ML Systems", label: "Consensus in distributed AI/ML training" },
  { key: "Consensus and Formal Verification", label: "Formal verification of consensus protocols" },
  { key: "Consensus Benchmarks", label: "Benchmarks and empirical evaluation of consensus protocols" },
  { key: "Recent Trends", label: "Recent trends and future directions in consensus research" },
  { key: "Consensus in Open Source", label: "Open source projects and their role in consensus evolution" }
]

// Output schema for each research agent
const FINDING_SCHEMA = {
  type: "object",
  required: ["subtopic", "name", "key_points", "sources"],
  properties: {
    subtopic: { type: "string", description: "The subtopic key (from the input)" },
    name: { type: "string", description: "Short name/title of the consensus topic or protocol" },
    key_points: {
      type: "array",
      items: { type: "string", description: "A key historical point or insight (1-2 sentences)" },
      minItems: 3,
      maxItems: 3,
      description: "Three key historical points or insights about this subtopic"
    },
    sources: {
      type: "array",
      items: { type: "string", format: "uri", description: "URL of a reputable source" },
      minItems: 1,
      maxItems: 3,
      description: "Up to 3 reputable source URLs (prefer academic, technical, or primary sources)"
    }
  }
}

// Output schema for the synthesized report
const SYNTHESIS_SCHEMA = {
  type: "object",
  required: ["report", "citations", "gaps"],
  properties: {
    report: { type: "string", description: "A comprehensive, well-structured report covering all subtopics, with in-text citations (e.g., [1], [2])" },
    citations: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "url", "title"],
        properties: {
          id: { type: "string", description: "Citation id (e.g., [1])" },
          url: { type: "string", format: "uri", description: "Source URL" },
          title: { type: "string", description: "Short title or description of the source" }
        }
      },
      description: "List of all sources cited in the report"
    },
    gaps: {
      type: "array",
      items: { type: "string", description: "Subtopic keys for which no research finding was available" },
      description: "List of subtopics with missing or incomplete findings"
    }
  }
}

// --- UTILITY ---

const WAVE_SIZE = 7
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// Stable prompt builder for each subtopic
function buildResearchPrompt(subtopic) {
  return `Research the following subtopic of the history of distributed consensus algorithms:

Subtopic: "${subtopic.label}"

Instructions:
- Summarize the topic with a short name/title.
- List exactly 3 key historical points or insights (1-2 sentences each).
- Provide up to 3 reputable source URLs (prefer academic, technical, or primary sources; no Wikipedia unless unavoidable).
- Do not include long quotes; summarize in your own words.
- Your output must fill this schema:
{
  subtopic: "${subtopic.key}",
  name: <short name/title>,
  key_points: [<point 1>, <point 2>, <point 3>],
  sources: [<url1>, <url2>, <url3>]
}
Return only the JSON object.`
}

// --- MAIN SCRIPT ---

phase('Research Swarm')
log(`Launching research swarm for ${SUBTOPICS.length} subtopics in waves of ${WAVE_SIZE}...`)

const findings = []
let failed = []

// Single source of truth for running a research agent
async function runResearchAgent(subtopic) {
  return agent(
    buildResearchPrompt(subtopic),
    {
      label: `research:${subtopic.key}`,
      phase: 'Research Swarm',
      schema: FINDING_SCHEMA,
      effort: 'medium'
    }
  )
}

// --- WAVE LOOP (Safe Swarm Patterns 1,2,3,8) ---
const waves = chunk(SUBTOPICS, WAVE_SIZE)
for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  log(`Wave ${w + 1}: researching ${waves[w].length} subtopics...`)
  const batch = await parallel(waves[w].map(subtopic => () => runResearchAgent(subtopic)))
  batch.forEach((result, i) => {
    if (result) findings.push(result)
    else failed.push(waves[w][i])
  })
  log(`Wave ${w + 1} complete: ${findings.length}/${SUBTOPICS.length} succeeded, ${failed.length} to retry`)
  // Instability backoff (Pattern 8)
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ Instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// --- RETRY WAVE (Pattern 2) ---
if (failed.length) {
  phase('Retry')
  log(`Retrying ${failed.length} failed subtopics...`)
  const retried = await parallel(failed.map(subtopic => () => runResearchAgent(subtopic)))
  const stillFailed = []
  retried.forEach((result, i) => {
    if (result) findings.push(result)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave: recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// --- SYNTHESIS (Patterns 5,7) ---
phase('Synthesis')

// Compute missing subtopics
const foundKeys = new Set(findings.map(f => f.subtopic))
const missing = SUBTOPICS.filter(s => !foundKeys.has(s.key)).map(s => s.key)
if (missing.length) log(`⚠ Partial: missing ${missing.length}/${SUBTOPICS.length}: ${missing.join(', ')}`)

// Prepare synthesis input (sorted for deterministic resume)
const findingsSorted = [...findings].sort((a, b) => (a.subtopic > b.subtopic ? 1 : -1))
const synthesisInput = JSON.stringify({
  findings: findingsSorted,
  missing
})

// Synthesis prompt
const synthPrompt =
  `You are to synthesize a comprehensive, well-structured report on the history of distributed consensus algorithms, covering the following subtopics:\n` +
  SUBTOPICS.map(s => `- ${s.label} (${s.key})`).join('\n') + `\n\n` +
  `For each subtopic, use the provided research findings (see below) to write a concise, informative section. Integrate the 3 key points for each, and cite sources in-text using bracketed numbers (e.g., [1], [2]).\n` +
  `At the end, include a numbered list of all sources cited, with their URLs and a short title. If any subtopics are missing findings, explicitly list them in a "Gaps and Limitations" section.\n\n` +
  `Research findings (JSON):\n${synthesisInput}\n\n` +
  `Instructions:\n- Write clearly and cohesively for a technical audience.\n- Use in-text citations ([1], [2], etc.) for all factual claims.\n- Do not invent information for missing subtopics; just list them as gaps.\n- Your output must fill this schema:\n` +
  JSON.stringify(SYNTHESIS_SCHEMA, null, 2)

const synthesis = await agent(
  synthPrompt,
  {
    label: 'synthesis',
    phase: 'Synthesis',
    schema: SYNTHESIS_SCHEMA,
    effort: 'high'
  }
)

// --- RETURN FINAL OUTPUT (Pattern 7) ---
return {
  findings: findingsSorted,
  missing,
  synthesis
}

// --- SCHEDULE WATCHDOG (Pattern 4) ---
// (This must be run at the agent level, not inside the script body. Include this in your deliverable.)
/*
ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/
```

> **Claude judge:** The script demonstrates strong safety-by-construction patterns: (1) bounded waves of 7 items via chunk(); (2) per-agent null-tolerance with a retry wave for failures; (3) results committed per wave into `findings` array before synthesis; (4) ScheduleWakeup watchdog present as a comment with explanation that it must be armed at agent level; (5) deterministic prompts with no Date.now/Math.random, stable label keys; (6) lean capped schemas (3 key_points, 3 sources); (7) synthesis explicitly tolerates partial input and flags gaps in output; (8) instability backoff when >40% of a wave fails. All 8 properties are present, with the watchdog being a comment/note rather than an armed call (partial credit), which is acknowledged as appropriate given it must be agent-level.

