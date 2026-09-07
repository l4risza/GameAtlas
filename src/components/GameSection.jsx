import '../styles/estilo.css'


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

export default GameSection

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