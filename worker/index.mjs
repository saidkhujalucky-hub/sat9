import {handle} from './api.mjs';
export default {async fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/'))return handle(request,env);return env.ASSETS.fetch(request);}};
