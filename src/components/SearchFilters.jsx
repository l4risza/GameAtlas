import { PLATFORMS, GENRES, SORTS } from '../services/search-options';

export default function SearchFilters({ platform, genre, sort, hideExtras, onChange, onReset }) {
    return <div className="search-filters" role="group" aria-label="Filtros da busca">
        <label htmlFor="search-platform">Plataforma
            <select id="search-platform" value={platform} onChange={(event) => onChange('plataforma', event.target.value)}>
                <option value="">Todas as plataformas</option>
                {PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
        </label>
        <label htmlFor="search-genre">Gênero
            <select id="search-genre" value={genre} onChange={(event) => onChange('genero', event.target.value)}>
                <option value="">Todos os gêneros</option>
                {GENRES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
        </label>
        <label htmlFor="search-sort">Ordenar por
            <select id="search-sort" value={sort} onChange={(event) => onChange('ordem', event.target.value)}>
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
        </label>
        <div className="search-filter-actions">
            <label className="search-filter-check" htmlFor="search-hide-extras">
                <input id="search-hide-extras" type="checkbox" checked={hideExtras}
                    onChange={(event) => onChange('ocultarExtras', String(event.target.checked))} />
                Ocultar demos e DLCs
            </label>
            <button className="api-button" type="button" onClick={onReset}>Restaurar filtros</button>
        </div>
    </div>;
}
