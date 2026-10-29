import { Link } from 'react-router-dom';
import { version } from '../../../package.json';

// Preencha os campos entre colchetes. Quando um valor deixa de ser "[...]", ele passa a aparecer de verdade:
// o e-mail vira link mailto: e os endereços viram links (começando com "/" abrem dentro do site; com "https://" abrem em outra aba).
const ABOUT = {
    version: `v${version}`,
    team: 'Desenvolvimento Web — Larissa Ferri e Guilherme Teruel | ' +
        'APIs e Banco de Dados — Gabriel Moreira | Documentação — Vinicius Allejandro',
    year: '2026',
    termsUrl: '[link dos termos de uso]',
    privacyUrl: '[link da política de privacidade]',
    contactEmail: '[e-mail de contato]',
};

const isPlaceholder = (value) => /^\[.*\]$/.test(String(value ?? '').trim());

function Value({ text, kind }) {
    if (isPlaceholder(text)) return <span className="config-placeholder">{text}</span>;
    if (kind === 'email') return <a href={`mailto:${text}`}>{text}</a>;
    if (kind === 'link' && text.startsWith('/')) return <Link to={text}>Abrir</Link>;
    if (kind === 'link' && /^https:\/\//i.test(text)) return <a href={text} target="_blank" rel="noopener noreferrer">Abrir</a>;
    return <>{text}</>;
}

function Rows({ rows }) {
    return <dl className="config-about">
        {rows.map(([label, text, kind]) => <div className="config-about__row" key={label}>
            <dt>{label}</dt>
            <dd><Value text={text} kind={kind} /></dd>
        </div>)}
    </dl>;
}

export default function ConfigSobre({ info = ABOUT }) {
    return <>
        <section aria-labelledby="config-sobre-title">
            <h2 className="config-section-title" id="config-sobre-title">Sobre o GameAtlas</h2>
            <p className="config-text">O GameAtlas é uma plataforma para descobrir jogos, compartilhar experiências e organizar
                jogos de diferentes plataformas em listas personalizadas.</p>
            <Rows rows={[['Versão', info.version], ['Ano', info.year], ['Equipe', info.team]]} />
        </section>

        <hr className="config-divider" />

        <section aria-labelledby="config-dados-title">
            <h2 className="config-section-title" id="config-dados-title">Dados dos jogos</h2>
            <p className="config-text">As informações e imagens dos jogos são fornecidas pela{' '}
                <a href="https://rawg.io" target="_blank" rel="noopener noreferrer">RAWG</a>. As reviews e as listas são escritas pelos
                usuários do GameAtlas.</p>
        </section>

        <hr className="config-divider" />

        <section aria-labelledby="config-privacidade-title">
            <h2 className="config-section-title" id="config-privacidade-title">Privacidade</h2>
            <p className="config-text">Para criar a conta, o GameAtlas guarda seu e-mail, nome de usuário e senha (a senha fica protegida, nunca em
                texto aberto). No perfil, você escolhe o que preencher: nome de exibição, foto de perfil, descrição, jogos
                favoritos e redes sociais.</p>
            <p className="config-text">São públicos o seu perfil, suas reviews e as suas listas marcadas como públicas. Outros usuários
                não veem seu e-mail nem suas listas privadas, e se optar por reviews privadas, elas serão visualizadas
                somente ao acessar a página de reviews sobre um jogo em específico, não em seu perfil.</p>
            <p className="config-text">Os dados ficam no Supabase, serviço de banco de dados e autenticação. As informações dos jogos
                vêm da RAWG. Para pedir a correção ou a exclusão dos seus dados, escreva para [e-mail de contato].</p>
        </section>
        <hr className="config-divider" />

        <section aria-labelledby="config-contato-title">
            <h2 className="config-section-title" id="config-contato-title">Contato</h2>
            <p className="config-text">Encontrou um erro ou tem uma sugestão? Fale com a gente.</p>
            <Rows rows={[['E-mail', info.contactEmail, 'email']]} />
        </section>
    </>;
}
