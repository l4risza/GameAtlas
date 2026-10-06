import { useApi } from './useApi';

export function useGame(id) {
    const { data, ...state } = useApi(`/jogos/${encodeURIComponent(id)}`);
    return { game: data, ...state };
}
