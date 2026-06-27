// Print the OpenAI model IDs your account can actually call, filtered to the families used in the
// matrix. Use this to pin the exact `openai:chat:<id>` strings in promptfooconfig.yaml before a
// run — rather than guessing IDs that may differ from what's enabled on your account.
//
//   bun run models     (or: npm run models)
import { requireKey } from "./_env.mjs";

const key = requireKey("OPENAI_API_KEY");

const res = await fetch("https://api.openai.com/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`OpenAI /v1/models returned ${res.status} ${res.statusText}`);
  process.exit(1);
}
const data = await res.json();
const ids = (data.data || [])
  .map((m) => m.id)
  .filter((id) => /^(gpt-5|gpt-4\.1|gpt-4o|o3|o4)/.test(id))
  .sort();

console.log("Candidate chat model IDs available to this account:\n");
for (const id of ids) console.log("  " + id);
console.log(
  "\nPick a frontier + mid + two floor IDs and set them as `openai:chat:<id>` in promptfooconfig.yaml."
);
