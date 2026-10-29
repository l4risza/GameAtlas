import '../styles/components.css';

const LABELS = { reviews: 'REVIEWS', listas: 'LISTAS' };

// "tabs" permite esconder uma aba (escolha feita em Configurações > Mostrar no perfil).
export default function ProfileTabs({ active, onChange, tabs = ['reviews', 'listas'] }) {
    return (
        <div className="profile-tabs">
            {tabs.map((key) => (
                <button
                    key={key}
                    type="button"
                    className={`profile-tab${active === key ? ' active' : ''}`}
                    onClick={() => onChange(key)}
                >
                    {LABELS[key]}
                </button>
            ))}
        </div>
    );
}
