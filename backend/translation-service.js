import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '@vitalets/google-translate-api';

const LANGUAGE_HEADING = /^(english|español|spanish|portugu[eê]s(?:\s*\((?:brasil|br)\))?|portuguese(?:\s*\(brazil\))?|français|french|deutsch|german|italiano|italian|русский|russian|日本語|japanese|한국어|korean|简体中文|繁體中文|chinese)\s*:?$/i;
const PORTUGUESE_HEADING = /^(portugu[eê]s|portuguese)/i;

// A RAWG às vezes concatena a descrição inglesa e sua cópia em espanhol.
export function selectDescription(source) {
    const sections = [];
    let section = { heading: '', lines: [] };
    for (const line of String(source || '').replace(/\r\n?/g, '\n').split('\n')) {
        const heading = line.trim();
        if (LANGUAGE_HEADING.test(heading)) {
            sections.push(section);
            section = { heading, lines: [] };
        } else section.lines.push(line);
    }
    sections.push(section);
    const populated = sections.map((item) => ({ ...item, text: item.lines.join('\n').trim() })).filter((item) => item.text);
    const selected = populated.find((item) => PORTUGUESE_HEADING.test(item.heading)) || populated[0];
    return { text: selected?.text || '', portuguese: Boolean(selected && PORTUGUESE_HEADING.test(selected.heading)) };
}

export function splitDescription(text, maxLength = 3000) {
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLength) {
        const prefix = remaining.slice(0, maxLength + 1);
        let cut = prefix.lastIndexOf('\n');
        if (cut < maxLength / 2) cut = prefix.lastIndexOf(' ');
        if (cut < 1) cut = maxLength;
        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
}

export function createTranslationService({
    translateImpl = translate,
    cacheDirectory = fileURLToPath(new URL('.cache/translations/', import.meta.url)),
    timeoutMs = 30000,
} = {}) {
    const memory = new Map();
    const pending = new Map();
    let queue = Promise.resolve();

    async function translateDescription(source) {
        const selected = selectDescription(source);
        if (!selected.text) return { text: '', status: 'empty', language: 'pt-BR' };
        if (selected.portuguese) return { text: selected.text, status: 'original', language: 'pt-BR' };
        const hash = createHash('sha256').update(`pt-BR:v1:${selected.text}`).digest('hex');
        if (memory.has(hash)) return memory.get(hash);
        if (pending.has(hash)) return pending.get(hash);

        const task = (async () => {
            const cachePath = cacheDirectory ? join(cacheDirectory, `${hash}.json`) : null;
            if (cachePath) {
                try {
                    const cached = JSON.parse(await readFile(cachePath, 'utf8'));
                    if (cached.sourceHash === hash && cached.language === 'pt-BR' && cached.text?.trim()) {
                        const result = { text: cached.text, status: 'translated', language: 'pt-BR' };
                        remember(hash, result);
                        return result;
                    }
                } catch { /* Um cache ausente ou inválido é recriado. */ }
            }

            const translateTask = queue.then(async () => {
                const signal = AbortSignal.timeout(timeoutMs);
                const translated = [];
                for (const chunk of splitDescription(selected.text)) {
                    const result = await translateImpl(chunk, { from: 'auto', to: 'pt-BR', fetchOptions: { signal } });
                    if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('A tradução não retornou texto.');
                    translated.push(result.text.trim());
                }
                return { text: translated.join('\n\n'), status: 'translated', language: 'pt-BR' };
            });
            // Uma falha não bloqueia os próximos jogos. A fila reduz chamadas simultâneas.
            queue = translateTask.catch(() => {});
            const result = await translateTask;
            remember(hash, result);
            if (cachePath) {
                try {
                    await mkdir(cacheDirectory, { recursive: true });
                    const tempPath = `${cachePath}.${randomUUID()}.tmp`;
                    await writeFile(tempPath, JSON.stringify({ sourceHash: hash, language: 'pt-BR', text: result.text }), 'utf8');
                    await rename(tempPath, cachePath);
                } catch { /* A tradução funciona mesmo se o disco estiver indisponível. */ }
            }
            return result;
        })();
        pending.set(hash, task);
        try { return await task; } finally { pending.delete(hash); }
    }

    function remember(hash, result) {
        if (memory.size >= 250) memory.delete(memory.keys().next().value);
        memory.set(hash, result);
    }
    return { translateDescription };
}
