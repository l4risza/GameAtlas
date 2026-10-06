export default function Footer() {
    return (
        <footer className="footer text-center py-4 mt-5">
            <p className="m-0">© {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.</p>
            <p className="rawg-credit">Dados e imagens de jogos fornecidos pela <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>.</p>
        </footer>
    );
}
