import GameCard from './GameCard';
import '../styles/components.css';

export default function GameSection({ title, games = [], showMetadata = false }) {
    // se a categoria ainda não tem jogos (ou a API não retornou nada), não renderiza a seção
    if (!games.length) return null;

    return (
        <section>
            <h4 className="section-title">{title}</h4>
            <hr />
            <div className="cards">
                {games.map((game) => (
                    <GameCard key={game.id} game={game} showMetadata={showMetadata} />
                ))}
            </div>
        </section>
    );
}


/*import '../styles/components.css'


function GameSection({ titulo }) {
    return (
        <section>
            <h2 style={{ color: "red" }}>
                {titulo}
            </h2>

            <p>
                TESTE DO GAMESECTION
            </p>

            <hr />
        </section>
    )
}

export default GameSection */

/*
function GameSection({ titulo, id }) {
    return (
        <section>
            <p className="section-title">{titulo}</p>
            <hr/>

            <div className="cards" id={id}>
                //Os GameCards serão colocados aqui
            </div>
        </section>
    )
}

export default GameSection
*/
