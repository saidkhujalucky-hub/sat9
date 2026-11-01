import {cpSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),destination=resolve(root,'dist/github-pages');
const api=process.env.API_URL||'';const apiOk=/^https:\/\/[^\s]+\/api\/?$/.test(api);if(!apiOk)(()=>{throw Error('Set API_URL to your published HTTPS Worker address ending in /api before building GitHub Pages.');})();
rmSync(destination,{recursive:true,force:true});mkdirSync(destination,{recursive:true});cpSync(resolve(root,'public'),destination,{recursive:true});
if(apiOk)writeFileSync(resolve(destination,'config.js'),`window.SAT_CONFIG={apiBase:${JSON.stringify(api.replace(/\/$/,''))}};\n`);
console.log('Frontend ready at '+destination+'. Publish only this folder.');
