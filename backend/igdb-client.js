import { ApiError } from './errors.js';
const error = (status,code,message) => new ApiError(status,code,message);
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));

export function createIgdbClient({clientId,clientSecret,fetchImpl=fetch,now=Date.now,sleep=pause,timeoutMs=15000}) {
    let token; let expires=0; let tokenTask; let queue=Promise.resolve(); let nextStart=0;
    async function json(response,auth=false) {
        try { return await response.json(); } catch { throw error(502,auth?'IGDB_AUTH_ERROR':'IGDB_INVALID_RESPONSE','O serviço retornou dados inválidos.'); }
    }
    async function getToken() {
        if(token&&expires>now()) return token;
        if(tokenTask) return tokenTask;
        tokenTask=(async()=>{
            let response;
            try { response=await fetchImpl('https://id.twitch.tv/oauth2/token',{method:'POST',
                headers:{'Content-Type':'application/x-www-form-urlencoded'},
                body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'}),signal:AbortSignal.timeout(timeoutMs)}); }
            catch { throw error(503,'IGDB_AUTH_UNAVAILABLE','Não foi possível autenticar na Twitch.'); }
            if(!response.ok) throw error(response.status===429?503:502,'IGDB_AUTH_ERROR','A Twitch recusou a autenticação do servidor.');
            const data=await json(response,true);
            if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)
                throw error(502,'IGDB_AUTH_ERROR','A Twitch retornou uma autenticação inválida.');
            token=data.access_token; expires=now()+Math.max(1,data.expires_in-Math.min(60,data.expires_in/10))*1000;
            return token;
        })();
        try{return await tokenTask;}finally{tokenTask=null;}
    }
    function schedule(task) {
        const run=queue.then(async()=>{await sleep(Math.max(0,nextStart-now()));nextStart=now()+260;return task();});
        queue=run.catch(()=>{});return run;
    }
    return async function query(endpoint,body) {
        if(!clientId||!clientSecret) throw error(503,'IGDB_NOT_CONFIGURED','Configure as credenciais da Twitch no servidor.');
        if(!/^(games|genres|platforms)(\/count)?$|^multiquery$/.test(endpoint)) throw error(400,'INVALID_ENDPOINT','Recurso inválido.');
        let refreshed=false;
        for(let attempt=0;attempt<3;attempt++) {
            const access=await getToken();
            let response;
            try { response=await schedule(()=>fetchImpl(`https://api.igdb.com/v4/${endpoint}`,{method:'POST',
                headers:{'Client-ID':clientId,Authorization:`Bearer ${access}`,Accept:'application/json','Content-Type':'text/plain'},
                body,signal:AbortSignal.timeout(timeoutMs)})); }
            catch(e) {
                if(e.name==='TimeoutError'||e.name==='AbortError') throw error(504,'IGDB_TIMEOUT','A IGDB demorou para responder.');
                if(attempt<2) {await sleep(250*(attempt+1));continue;}
                throw error(502,'IGDB_UNAVAILABLE','Não foi possível conectar à IGDB.');
            }
            if(response.status===401&&!refreshed) {token=null;expires=0;refreshed=true;continue;}
            if([401,403].includes(response.status)) throw error(502,'IGDB_AUTH_ERROR','A IGDB recusou a autenticação do servidor.');
            if(response.status===404) throw error(404,'GAME_NOT_FOUND','Jogo não encontrado.');
            if(response.status===429||response.status>=500) {
                if(attempt<2) {const retry=Number(response.headers.get('retry-after'));await sleep(Math.min(2000,Math.max(250,Number.isFinite(retry)?retry*1000:500)));continue;}
                throw error(response.status===429?503:502,response.status===429?'IGDB_RATE_LIMIT':'IGDB_UNAVAILABLE','A IGDB está temporariamente indisponível.');
            }
            if(!response.ok) throw error(502,'IGDB_QUERY_ERROR','A IGDB recusou a consulta.');
            const data=await json(response);
            if(endpoint.endsWith('/count')?(!Number.isInteger(data?.count)||data.count<0):!Array.isArray(data))
                throw error(502,'IGDB_INVALID_RESPONSE','A IGDB retornou dados inválidos.');
            return {data};
        }
        throw error(502,'IGDB_AUTH_ERROR','Não foi possível renovar a autenticação da IGDB.');
    };
}
