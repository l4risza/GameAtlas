import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import GamePicker from '../GamePicker';
import { addSelectedFavorite, favoriteKey, favoriteTitle } from '../../services/favorite-games-model';

export default function FavoriteGamesEditor({ items, disabled, onChange }) {
    const labelId = useId();
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    async function change(next) {
        setBusy(true); setError('');
        try { await onChange(next); } catch (error) { setError(error.message); throw error; } finally { setBusy(false); }
    }
    async function add(game) {
        await change(addSelectedFavorite(items, game));
        setAdding(false);
    }
    return <div className="config-row">
        <span className="config-label" id={labelId}>Jogos favoritos:</span>
        <div className="config-field config-field--wrap">
            <ul className="config-pills" aria-labelledby={labelId}>
                {items.map(game => <li className="config-pill" key={favoriteKey(game)}>
                    {typeof game === 'string' ? <span>{game}</span> : <Link to={`/jogo/${game.id}`}>{game.title}</Link>}
                    <button type="button" className="config-pill__remove" disabled={disabled || busy} aria-label={`Remover ${favoriteTitle(game)}`}
                        onClick={() => { change(items.filter(item => favoriteKey(item) !== favoriteKey(game))).catch(() => {}); }}>
                        <i className="bi bi-x" aria-hidden="true"></i></button>
                </li>)}
            </ul>
            {!adding && <button type="button" className="config-add-btn" aria-label="Adicionar jogo favorito"
                disabled={disabled || busy || (items.length >= 5 && items.every(game => typeof game !== 'string'))} onClick={() => { setAdding(true); setError(''); }}>
                <i className="bi bi-plus-lg" aria-hidden="true"></i></button>}
        </div>
        {adding && <div className="config-favorites-picker">
            <GamePicker label="Buscar jogo favorito" onSelect={add} disabled={disabled || busy}
                excludedIds={items.filter(game => typeof game !== 'string').map(game => game.id)} />
            <button type="button" className="config-btn config-btn--outline" disabled={busy} onClick={() => setAdding(false)}>Cancelar</button>
        </div>}
        {items.some(game => typeof game === 'string') && <p className="config-hint config-favorites-picker">
            Para abrir um favorito antigo, selecione o jogo correspondente na busca. Os nomes digitados antes foram mantidos.</p>}
        {error && <p className="config-error" role="alert">{error}</p>}
    </div>;
}
