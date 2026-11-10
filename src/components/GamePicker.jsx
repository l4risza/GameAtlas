import { useEffect, useId, useState } from 'react';
import { requestJson } from '../services/api';
import '../styles/game-picker.css';

export default function GamePicker({ onSelect, excludedIds = [], disabled = false, label = 'Buscar jogo', actionLabel = 'Adicionar' }) {
    const inputId = useId();
    const [draft, setDraft] = useState('');
    const [response, setResponse] = useState(null);
    const [selection, setSelection] = useState({ id: null, error: '' });
    const term = draft.trim();

    useEffect(() => {
        if (term.length < 2) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const data = await requestJson(`/jogos/busca?q=${encodeURIComponent(term)}&sort=popular&hide_extras=true&page_size=8`, { signal: controller.signal });
                if (!controller.signal.aborted) setResponse({ term, games: data.results, error: '' });
            } catch (error) {
                if (!controller.signal.aborted) setResponse({ term, games: [], error: error.message });
            }
        }, 300);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [term]);

    async function choose(game) {
        setSelection({ id: game.id, error: '' });
        try {
            await onSelect(game);
            setDraft(''); setResponse(null);
            setSelection({ id: null, error: '' });
        } catch (error) {
            setSelection({ id: null, error: error.message || 'Não foi possível adicionar o jogo.' });
        }
    }

    const current = response?.term === term ? response : null;
    const busy = selection.id !== null;
    return <div className="game-picker">
        <label htmlFor={inputId}>{label}</label>
        <input id={inputId} className="game-picker__input" type="search" value={draft} maxLength={200}
            placeholder="Digite pelo menos 2 letras" autoComplete="off" disabled={disabled || busy}
            onChange={(event) => { setDraft(event.target.value); setResponse(null); setSelection({ id: null, error: '' }); }} />
        {term.length >= 2 && !current && <p role="status">Buscando jogos...</p>}
        {current?.error && <p role="alert">{current.error}</p>}
        {current && !current.error && !current.games.length && <p role="status">Nenhum jogo encontrado. Tente outro nome.</p>}
        {current?.games.length > 0 && <ul className="game-picker__results" aria-label="Jogos encontrados">
            {current.games.map((game) => {
                const added = excludedIds.includes(game.id);
                return <li key={game.id}><button type="button" className="game-picker__result" disabled={disabled || busy || added}
                    aria-label={`${added ? 'Já adicionado' : actionLabel}: ${game.title}`} onClick={() => choose(game)}>
                    <img src={game.image || '/images/game-placeholder.svg'} alt="" loading="lazy" />
                    <span className="game-picker__name">{game.title}{game.year && <small>{game.year}</small>}</span>
                    <span className="game-picker__action">{added ? 'Adicionado' : selection.id === game.id ? 'Adicionando...' : actionLabel}</span>
                </button></li>;
            })}
        </ul>}
        {selection.error && <p role="alert">{selection.error}</p>}
    </div>;
}
