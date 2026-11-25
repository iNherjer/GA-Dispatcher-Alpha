// Hourly trigger for the GitHub workflow "DWD weather assets (Alpha)".
//
// GitHub delays or drops scheduled workflows under load (24./25.11.2026: four
// runs in 36 hours), so the published DWD window ran out. Cloudflare cron
// triggers fire on time; this worker only asks GitHub to start the workflow
// (workflow_dispatch). The workflow itself decides whether anything changed.
//
// Secret GITHUB_TOKEN: fine-grained token for iNherjer/GA-Dispatcher-Alpha
// with "Actions: Read and write" only. Set it with
//   npx wrangler secret put GITHUB_TOKEN --config tools/dwd-dispatch-worker/wrangler.toml
const REPO = 'iNherjer/GA-Dispatcher-Alpha';
const WORKFLOW = 'dwd-weather-assets.yml';

async function dispatch(env) {
  if (!env.GITHUB_TOKEN) {
    console.log('DWD_DISPATCH_SKIPPED missing GITHUB_TOKEN');
    return { ok: false, status: 0 };
  }
  const response = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ga-dwd-dispatch',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({ ref: 'main' })
  });
  // 204 = queued. Body of an error answer is logged without the token.
  const detail = response.status === 204 ? '' : (await response.text()).slice(0, 200);
  console.log(`DWD_DISPATCH status=${response.status} ${detail}`);
  return { ok: response.status === 204, status: response.status };
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(dispatch(env));
  }
};
