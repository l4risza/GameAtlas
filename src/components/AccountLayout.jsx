import { Link, Navigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '../context/auth-context';
import '../styles/account.css';

export default function AccountLayout({ title, children, requireLogin = false }) {
    const { user, loading, configured } = useAuth();
    const location = useLocation();
    if (requireLogin && configured && !loading && !user) {
        return <Navigate to={`/login?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }
    return <><Navbar /><main className="account-page"><h1>{title}</h1>
        {!configured ? <p role="alert">A conexão com o banco ainda não está configurada.</p>
            : requireLogin && loading ? <p role="status">Carregando sua conta...</p> : children}
    </main><Footer /></>;
}

export function Pagination({ page, count, pageSize = 12, onChange }) {
    const pages = Math.max(1, Math.ceil(count / pageSize));
    return pages > 1 && <nav className="api-pagination" aria-label="Paginação">
        <button className="api-button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
        <span>Página {page} de {pages}</span>
        <button className="api-button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Próxima</button>
    </nav>;
}

export function GameTile({ game, children }) {
    return <article className="account-game-tile"><Link to={`/jogo/${game.rawg_id}`}>
        <img src={game.capa_url || '/images/game-placeholder.svg'} alt="" loading="lazy" />
        <h3>{game.nome}</h3></Link>{children}</article>;
}
