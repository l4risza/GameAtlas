import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import '../styles/components.css';

export default function Navbar({
    logoSrc = '/images/controle.png',
    brandName = 'GameAtlas',
    links = [
        { label: 'EXPLORAR', to: '/explorar' },
        { label: 'REVIEWS', to: '/reviews' },
        { label: 'LISTAS', to: '/listas' },
    ],
    // ---- estado de autenticação ----
    isLoggedIn = true,
    perfilHref = '/perfil',
    configHref = '/configuracoes',
    // ---- customização de estilo (viram CSS variables usadas em components.css) ----
    fontFamily,
    fontSize,
    gap,
    paddingX,
    paddingY,
    logoSize,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const navigate = useNavigate();

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (!searchValue.trim()) return;
        navigate(`/explorar?busca=${encodeURIComponent(searchValue)}`);
        setSearchValue('');
        setMenuOpen(false);
    };

    const closeMenu = () => setMenuOpen(false);

    // só sobrescreve as variáveis CSS que o usuário efetivamente passou
    const themeVars = {
        ...(fontFamily && { '--font-family': fontFamily }),
        ...(fontSize && { '--font-size-base': fontSize }),
        ...(gap && { '--nav-gap': gap }),
        ...(paddingX && { '--nav-padding-x': paddingX }),
        ...(paddingY && { '--nav-padding-y': paddingY }),
        ...(logoSize && { '--logo-size': logoSize }),
    };

    return (
        <header className="header fixed-top" style={themeVars}>
            <nav className="navbar">
                <div className="container-fluid navbar-inner">

                    <div className="navbar-brand-wrap">
                        <Link className="nav-link active brand-link" to="/" onClick={closeMenu}>
                            <img src={logoSrc} alt="logo" className="logo-img" />
                            <h5 className="title m-0">{brandName}</h5>
                        </Link>
                    </div>

                    <button
                        className="navbar-toggler"
                        type="button"
                        aria-controls="navbarSupportedContent"
                        aria-expanded={menuOpen}
                        aria-label="Alternar navegação"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    <div
                        className={`navbar-collapse ${menuOpen ? 'show' : ''}`}
                        id="navbarSupportedContent"
                    >
                        <ul className="navbar-nav navbar-links">
                            {links.map((link) => (
                                <li className="nav-item" key={link.to}>
                                    <NavLink
                                        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                                        to={link.to}
                                        onClick={closeMenu}
                                    >
                                        {link.label}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>

                        <div className="navbar-actions">
                            <form
                                className="search-form"
                                id="pesquisa"
                                role="search"
                                onSubmit={handleSearchSubmit}
                            >
                                <input
                                    id="inputpesquisa"
                                    type="search"
                                    placeholder="Pesquisar..."
                                    aria-label="Search"
                                    value={searchValue}
                                    onChange={(e) => setSearchValue(e.target.value)}
                                />
                                <button type="submit" id="btnpesquisa">
                                    <i className="bi bi-search"></i>
                                </button>
                            </form>

                            {isLoggedIn ? (
                                <ul className="navbar-nav navbar-account">
                                    <li className="nav-item">
                                        <Link className="nav-link text-nowrap" to={perfilHref} onClick={closeMenu}>
                                            PERFIL
                                        </Link>
                                    </li>
                                    <li className="nav-item">
                                        <Link
                                            className="nav-link nav-link-icon"
                                            to={configHref}
                                            aria-label="Configurações"
                                            onClick={closeMenu}
                                        >
                                            <i className="bi bi-gear"></i>
                                            <span className="account-label-mobile">CONFIGURAÇÕES</span>
                                        </Link>
                                    </li>
                                </ul>
                            ) : (
                                <ul className="navbar-nav navbar-account">
                                    <li className="nav-item">
                                        <Link className="nav-link text-nowrap" id="navlogin" to="/login" onClick={closeMenu}>
                                            LOGIN
                                        </Link>
                                    </li>
                                    <li className="nav-item">
                                        <Link className="nav-link text-nowrap" to="/cadastro" onClick={closeMenu}>
                                            CADASTRE-SE
                                        </Link>
                                    </li>
                                </ul>
                            )}
                        </div>
                    </div>

                </div>
            </nav>
        </header>
    );
}