import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// A chave fica apenas no servidor, nunca em uma variável VITE_.
dotenv.config({
    path: [fileURLToPath(new URL('.env.local', import.meta.url)), fileURLToPath(new URL('.env', import.meta.url))],
    quiet: true,
});

export function readConfig(env = process.env) {
    const port = Number(env.PORT || 3001);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT deve ser um número entre 1 e 65535.');
    }
    return {
        port,
        apiKey: env.RAWG_API_KEY?.trim() || '',
        supabaseUrl: env.SUPABASE_URL?.trim() || '',
        supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY?.trim() || '',
        supabaseSecretKey: env.SUPABASE_SECRET_KEY?.trim() || '',
        corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
            .split(',').map((origin) => origin.trim()).filter(Boolean),
    };
}
