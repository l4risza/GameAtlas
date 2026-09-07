import '../styles/components.css'


function Footer() {
    return (
        <footer className="footer text-center py-4 mt-5">
            <p className="m-0">© {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.</p>
        </footer>
    )
}

export default Footer