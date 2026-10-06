const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export async function requestJson(path, { signal } = {}) {
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, { signal });
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new Error('Não foi possível conectar à API do GameAtlas. Verifique se o servidor está em execução.', { cause: error });
    }
    let data;
    try { data = await response.json(); } catch {
        throw new Error('A API não retornou uma resposta válida. Verifique a configuração do servidor.');
    }
    if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os jogos.');
    return data;
}

export const getGameById = (id, options) => requestJson(`/jogos/${encodeURIComponent(id)}`, options);
export const searchGames = async (term, options) => {
    if (!term?.trim()) return [];
    const data = await requestJson(`/jogos/busca?q=${encodeURIComponent(term.trim())}`, options);
    return data.results;
};
