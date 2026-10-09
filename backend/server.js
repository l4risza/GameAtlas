import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createRawgService } from './rawg-service.js';
import { createTranslationService } from './translation-service.js';
import { createSupabaseService } from './supabase-service.js';

const config = readConfig();
const translations = createTranslationService();
const rawg = createRawgService({
    apiKey: config.apiKey,
    catalogCacheFile: new URL('./.cache/name-catalog.json', import.meta.url),
    translateDescription: translations.translateDescription,
    onDiagnostic: ({ endpoint, attempt, status, code, retrying }) => {
        console.warn(`[RAWG] ${endpoint}: tentativa=${attempt} status=${status ?? 'rede'} código=${code} repetir=${retrying}`);
    },
});
const supabaseService = createSupabaseService({ url: config.supabaseUrl,
    publishableKey: config.supabasePublishableKey, secretKey: config.supabaseSecretKey });
const app = createApp({ rawg, supabaseService, corsOrigins: config.corsOrigins });
if (!config.apiKey) console.warn('Configure RAWG_API_KEY em backend/.env.local para consultar jogos.');
const server = app.listen(config.port, () => console.log(`GameAtlas API: http://localhost:${config.port}`));
server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? `A porta ${config.port} já está em uso.` : 'Não foi possível iniciar a API.');
    process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
