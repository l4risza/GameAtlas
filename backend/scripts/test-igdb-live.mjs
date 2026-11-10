import assert from 'node:assert/strict';
import {readConfig} from '../config.js';
import {createIgdbService} from '../igdb-service.js';
const c=readConfig();
const service=createIgdbService({clientId:c.twitchClientId,clientSecret:c.twitchClientSecret});
try {
    const list=await service.listGames({page_size:2,hide_extras:true});
    assert.ok(list.results.length);assert.ok(list.count>2);
    const game=await service.getGame(list.results[0].id);assert.equal(game.id,list.results[0].id);
    for(const params of [{search:'craft',sort:'relevance'},{genres:'indie'},{parent_platforms:'playstation'},
        {platforms:'6'},{developers:'rockstar-games'},{metacritic:'70,100'},{tags:'multiplayer'}]) {
        const r=await service.listGames({...params,page_size:1});assert.ok(r.results.length);assert.ok(r.count>0);
        if(params.search)assert.ok(r.results[0].title.toLowerCase().includes(params.search));
    }
    const cats=['emAlta','melhoresAv','lancamentos','classicos','indie','multiplayer'];
    const r=await service.categories(cats);assert.ok(cats.every(k=>r.categories[k]?.length));
    for(const resource of ['genres','platforms'])assert.ok((await service.metadata(resource,{})).results.length);
    console.log(JSON.stringify({ok:true,total:list.count,game:{id:game.id,title:game.title},checks:'listagem, ID, busca parcial, filtros, seis categorias e metadados'}));
}catch(error){console.error(JSON.stringify({ok:false,code:error.code||'ASSERTION_FAILED'}));process.exitCode=1;}
