import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import GameSection from '../components/GameSection';
import Footer from '../components/Footer';
import ApiFeedback from '../components/ApiFeedback';
import SearchFilters from '../components/SearchFilters';
import { PLATFORMS, GENRES, SORTS, categoryExploreLink } from '../services/search-options'; // NOVO: categoryExploreLink
import { useGames } from '../hooks/useGames';
import '../styles/components.css';
import '../styles/api.css';

const SECTIONS = [
    ['emAlta', 'Em alta'], ['melhoresAv', 'Melhores avaliados no Metacritic'],
    ['lancamentos', 'Lançamentos recentes'], ['classicos', 'Clássicos'],
    ['indie', 'Indie'], ['multiplayer', 'Multiplayer'],
];

export default function Explorar() {
    const [params, setParams] = useSearchParams();
    const search = (params.get('busca') || '').trim();
    const parsedPage = Number(params.get('page') || 1);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 && parsedPage <= 10000 ? parsedPage : 1;
    const validOption = (name, options, fallback = '') => options.some(([value]) => value === params.get(name)) ? params.get(name) : fallback;
    const platform = validOption('plataforma', PLATFORMS);
    const genre = validOption('genero', GENRES);
    const sort = validOption('ordem', SORTS, 'relevance');
    const hideExtras = params.get('ocultarExtras') !== 'false';
    const parsedBatch = Number(params.get('lote') || 1);
    const batch = Number.isInteger(parsedBatch) && parsedBatch > 0 && parsedBatch <= 20 ? parsedBatch : 1;
    const dates = (params.get('dates') || '').trim();
    const tags = (params.get('tags') || '').trim();
    const browsing = !search && Boolean(platform || genre || dates || tags || (sort && sort !== 'relevance'));
    const { loading, error, reload, resolveCategory, results, count, countScope, next, previous, hasMore } =
        useGames({ search, page, platform, genre, sort, hideExtras, batch, dates, tags });
    const updateParams = (name, value, reset = false) => setParams((current) => {
        const updated = new URLSearchParams(current);
        if (value) updated.set(name, value); else updated.delete(name);
        if (reset) { updated.delete('page'); updated.delete('lote'); }
        return updated;
    });
    const changePage = (value) => updateParams('page', String(value));
    return (
        <>
            <Navbar />
            <main className="container-fluid px-3 px-lg-5 api-page">
                {search && <h1 className="api-title">Resultados para “{search}”</h1>}
                <SearchFilters platform={platform} genre={genre} sort={sort} hideExtras={hideExtras}
                    onChange={(name, value) => updateParams(name, value, true)}
                    onReset={() => setParams(search ? { busca: search } : {})} />
                <div className="search-filter-actions">
                    <button className="api-button" type="button" onClick={() => updateParams('ordem', 'name', true)}>
                        Todos os jogos (A–Z)
                    </button>
                </div>
                <ApiFeedback loading={loading} error={error} onRetry={reload} />
                {!loading && !error && ((search || browsing) ? <>
                    <p className="api-summary">{count} jogos encontrados{countScope === 'page' ? ' nesta página' : ''}.</p>
                    {results.length ? <GameSection title={search ? `Página ${page}` : 'Jogos filtrados'} games={results} showMetadata />
                        : <p className="api-summary">Nenhum jogo encontrado com essa busca e esses filtros.</p>}
                    <nav className="api-pagination" aria-label="Páginas dos resultados">
                        <button className="api-button" type="button" disabled={previous === null} onClick={() => changePage(previous)}>Anterior</button>
                        <span>Página {page}</span>
                        <button className="api-button" type="button" disabled={next === null} onClick={() => changePage(next)}>Próxima</button>
                    </nav>
                    {hasMore && next === null && <div className="search-more">
                        <button className="api-button" type="button" onClick={() => setParams((current) => {
                            const updated = new URLSearchParams(current);
                            updated.set('lote', String(batch + 1)); updated.delete('page');
                            return updated;
                        })}>Buscar mais jogos</button>
                    </div>}
                </> : SECTIONS.map(([key, title]) => (
                    <GameSection key={key} title={title} games={resolveCategory(key)} seeMoreTo={categoryExploreLink(key)} />
                )))}
            </main>
            <Footer />
        </>
    );
}