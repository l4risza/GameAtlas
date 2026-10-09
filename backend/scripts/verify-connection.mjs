import { readConfig } from '../config.js';
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
const config = readConfig();
const client = createClient(config.supabaseUrl, config.supabaseSecretKey,
    { auth: { persistSession: false, autoRefreshToken: false } });
const counts = {};
for (const table of ['perfis', 'jogos', 'reviews', 'listas', 'lista_jogos', 'jogos_salvos']) {
    const response = await client.from(table).select('*', { count: 'exact', head: true });
    if (response.error) throw new Error('Falha ao verificar ' + table);
    counts[table] = response.count;
}
let leak = false;
for (const file of await readdir('./dist/assets')) {
    if (!file.endsWith('.js')) continue;
    const bundle = await readFile('./dist/assets/' + file, 'utf8');
    if ((config.supabaseSecretKey && bundle.includes(config.supabaseSecretKey))
        || (config.apiKey && bundle.includes(config.apiKey))) leak = true;
}
const response = await fetch(config.supabaseUrl + '/auth/v1/settings',
    { headers: { apikey: config.supabasePublishableKey } });
if (!response.ok) throw new Error('Não foi possível verificar o cadastro.');
const settings = await response.json();
console.log(JSON.stringify({ counts, privateKeysAbsentFromBuild: !leak,
    signupEnabled: !settings.disable_signup, emailConfirmationRequired: !settings.mailer_autoconfirm }));
