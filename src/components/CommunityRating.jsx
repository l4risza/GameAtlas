import { useCallback } from 'react';
import { useAccountData } from '../hooks/useAccountData';
import { database, resultOf } from '../services/supabase';
import { ratingColor } from '../services/rating-color';

export default function CommunityRating({ gameId }) {
    const load = useCallback(async () => {
        const { data } = await resultOf(database().rpc('resumo_avaliacoes_jogo', { igdb_id: gameId }));
        return data;
    }, [gameId]);
    const { data, loading, error, reload } = useAccountData(`nota-comunidade:${gameId}`, load);
    const average = Number.isFinite(data?.average) ? data.average : null;
    return <div className="rating-critics rating-community" aria-label="Avaliação da comunidade GameAtlas">
        <span>Comunidade GameAtlas</span>
        {loading ? <small role="status">Carregando...</small> : error ? <button type="button" onClick={reload}>Tentar novamente</button> : average === null
            ? <small>Sem avaliações</small>
            : <>
                <span className="stars" role="img" aria-label={`${average.toFixed(1)} de 5 estrelas`} style={{ '--star-color': ratingColor(average) }}>
                    <span className="stars-base" aria-hidden="true">★★★★★</span>
                    <span className="stars-fill" aria-hidden="true" style={{ width: `${average / 5 * 100}%` }}>★★★★★</span>
                </span>
                <strong>{average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<small>/5</small></strong>
                <span className="rating-count">{data.count} {data.count === 1 ? 'avaliação' : 'avaliações'}</span>
            </>}
    </div>;
}
