import {readFile,readdir} from 'node:fs/promises';
import {readConfig} from '../config.js';
import {fileURLToPath} from 'node:url';
const config=readConfig();
const secrets=Object.entries(process.env).filter(([name,value])=>/SECRET|TOKEN|API_KEY/.test(name)&&value?.length>=12).map(([,value])=>value);
if(config.twitchClientSecret)secrets.push(config.twitchClientSecret);
if(config.supabaseSecretKey)secrets.push(config.supabaseSecretKey);
async function scan(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=path+'/'+entry.name;if(entry.isDirectory())await scan(file);else{const contents=await readFile(file);if(secrets.some(value=>contents.includes(Buffer.from(value))))throw new Error('Credencial privada encontrada no build; publicação bloqueada.');}}}
await scan(fileURLToPath(new URL('../../dist',import.meta.url)));
console.log('OK: build sem valores das credenciais privadas configuradas.');
