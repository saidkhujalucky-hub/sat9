import {spawnSync} from 'node:child_process';
const commands=[['scripts/check.mjs'],['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--outdir','dist/worker'],['--test','tests/accounts.test.mjs','tests/platform.test.mjs','tests/worker.test.mjs']];
for(const args of commands){const r=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(r.status!==0)process.exit(r.status||1);}
