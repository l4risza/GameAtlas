import { Link } from 'react-router-dom';

function ListCover({ covers = [] }) {
    const slots = Array.from({ length: 4 }, (_, index) => covers[index]);
    return (
        <div className="list-cover" aria-hidden="true">
            {slots.map((src, index) => (src ? <img key={index} src={src} alt="" loading="lazy" /> : <span key={index} />))}
        </div>
    );
}

// Cartão genérico: serve para listas personalizadas e para a lista geral de salvos.
export function ListTile({ to, title, description, total = 0, covers, badge, meta, featured = false }) {
    return (
        <article className={`list-tile${featured ? ' list-tile--featured' : ''}`}>
            <ListCover covers={covers} />
            <div className="list-tile-body">
                <h2><Link to={to}>{title}</Link></h2>
                <div className="list-tile-meta">
                    <span>{total} {total === 1 ? 'jogo' : 'jogos'}</span>
                    {badge && <span className="list-badge">{badge}</span>}
                    {meta && <span>{meta}</span>}
                </div>
                {description && <p>{description}</p>}
            </div>
        </article>
    );
}

export function ListCard({ list }) {
    const owner = list.perfis?.username ? `@${list.perfis.username}` : list.perfis?.nome || 'Jogador';
    return (
        <ListTile
            to={`/listas/${list.id}`}
            title={list.nome}
            description={list.descricao}
            total={list.total}
            covers={list.covers}
            badge={list.publica ? 'Pública' : 'Privada'}
            meta={`por ${owner}`}
        />
    );
}