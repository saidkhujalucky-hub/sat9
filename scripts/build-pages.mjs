import {cpSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),destination=resolve(root,'dist/github-pages');
const api=process.env.API_URL||'';const apiOk=/^https:\/\/[^\s]+\/api\/?$/.test(api);if(!apiOk)console.warn('WARNING: API_URL не задан (нужен вид https://sat8.XXX.workers.dev/api). Сайт соберётся, но API работать не будет.');
rmSync(destination,{recursive:true,force:true});mkdirSync(destination,{recursive:true});cpSync(resolve(root,'public'),destination,{recursive:true});
if(apiOk)writeFileSync(resolve(destination,'config.js'),`window.SAT_CONFIG={apiBase:${JSON.stringify(api.replace(/\/$/,''))}};\n`);
console.log('Frontend ready at '+destination+'. Publish only this folder.');
