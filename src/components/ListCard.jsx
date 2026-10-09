import { Link } from 'react-router-dom';

export function ListCard({ list }) {
    return <article className="account-panel"><h2><Link to={`/listas/${list.id}`}>{list.nome}</Link></h2>
        <p>{list.publica ? 'Pública' : 'Privada'} · {list.perfis?.username ? `@${list.perfis.username}` : list.perfis?.nome || 'Jogador'}</p>
        {list.descricao && <p>{list.descricao}</p>}
    </article>;
}
