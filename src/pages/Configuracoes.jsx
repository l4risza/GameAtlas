import { useSearchParams } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import ConfigPerfil from '../components/config/ConfigPerfil';
import ConfigConta from '../components/config/ConfigConta';
import ConfigSobre from '../components/config/ConfigSobre';
import { useAuth } from '../context/auth-context';
import '../styles/config.css';

const TABS = [['perfil', 'Perfil'], ['conta', 'Conta'], ['sobre', 'Sobre']];

export default function Configuracoes() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const requested = params.get('aba');
    const tab = TABS.some(([key]) => key === requested) ? requested : 'perfil';
    const select = (key) => setParams(key === 'perfil' ? {} : { aba: key }, { replace: true });

    return <AccountLayout title="Configurações" requireLogin>
        {user && <div className="config-card">
            <div className="config-tabs" role="tablist" aria-label="Seções de configurações">
                {TABS.map(([key, label]) => <button key={key} type="button" role="tab" id={`config-tab-${key}`}
                    className="config-tab" aria-selected={tab === key} aria-controls="config-panel"
                    onClick={() => select(key)}>{label}</button>)}
            </div>
            <div className="config-panel" id="config-panel" role="tabpanel" aria-labelledby={`config-tab-${tab}`}>
                {tab === 'perfil' && <ConfigPerfil userId={user.id} />}
                {tab === 'conta' && <ConfigConta />}
                {tab === 'sobre' && <ConfigSobre />}
            </div>
        </div>}
    </AccountLayout>;
}
