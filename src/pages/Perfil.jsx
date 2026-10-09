import { useCallback, useState } from 'react';
import AccountLayout, { Pagination } from '../components/AccountLayout';
import ProfileTabs from '../components/ProfileTabs';
import ReviewCard from '../components/ReviewCard';
import { ListCard } from '../components/ListCard';
import ApiFeedback from '../components/ApiFeedback';
import { useProfile } from '../hooks/useProfile';
import { useAccountData } from '../hooks/useAccountData';
import { database, resultOf, accountError } from '../services/supabase';
import { loadLists, loadReviews } from '../services/account';

function ProfileEditor({ profile, onSaved }) {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    async function submit(event) {
        event.preventDefault(); setBusy(true); setError(''); setNotice('');
        const form = new FormData(event.currentTarget);
        const avatar = form.get('avatar_url').trim();
        try {
            if (avatar && !/^https:\/\//i.test(avatar)) throw new Error('A foto deve usar um endereço HTTPS.');
            await resultOf(database().from('perfis').update({ nome: form.get('nome').trim(),
                username: form.get('username').trim() || null, bio: form.get('bio').trim() || null,
                avatar_url: avatar || null }).eq('id', profile.id).select('id').single());
            setNotice('Perfil atualizado.'); onSaved();
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <details className="account-panel"><summary>Editar perfil</summary>
        <form className="account-form" onSubmit={submit}>
            <label>Nome de exibição<input name="nome" defaultValue={profile.nome} maxLength={100} required /></label>
            <label>Nome de usuário<input name="username" defaultValue={profile.username || ''} pattern="[A-Za-z0-9_]{3,30}" maxLength={30} />
                <small>De 3 a 30 letras, números ou sublinhados.</small></label>
            <label>Foto de perfil (URL)<input name="avatar_url" type="url" defaultValue={profile.avatar_url || ''} placeholder="https://..." /></label>
            <label>Sobre mim<textarea name="bio" defaultValue={profile.bio || ''} maxLength={1000} rows={4} /></label>
            {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
            <button className="api-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar perfil'}</button>
        </form>
    </details>;
}

function ProfileContent({ userId, tab }) {
    const [page, setPage] = useState(1);
    const load = useCallback(() => tab === 'reviews' ? loadReviews(page, userId) : loadLists(page, userId), [page, tab, userId]);
    const { data, loading, error, reload } = useAccountData(userId + ':' + tab + ':' + page, load);
    return <section className="profile-content"><ApiFeedback loading={loading} error={error} onRetry={reload} />
        {data && <>{!data.items.length && <p>{tab === 'reviews' ? 'Você ainda não avaliou nenhum jogo.' : 'Você ainda não criou uma lista.'}</p>}
            {data.items.map((item) => tab === 'reviews' ? <ReviewCard key={item.id} review={item} /> : <ListCard key={item.id} list={item} />)}
            <Pagination page={page} count={data.count} onChange={setPage} /></>}
    </section>;
}

export default function Perfil() {
    const { profile, loading, error, reload } = useProfile();
    const [tab, setTab] = useState('reviews');
    return <AccountLayout title="Meu perfil" requireLogin>
        <ApiFeedback loading={loading} error={error} onRetry={reload} />
        {profile && <>
            <section className="profile-card"><div className="profile-top">
                <div className="profile-photo-box"><img src={profile.avatar_url || '/images/perfil.png'} alt="Foto de perfil" className="profile-photo" /></div>
                <div className="profile-info"><h2>{profile.nome}</h2>{profile.username && <p>@{profile.username}</p>}</div>
            </div><section className="info-card"><h3>Sobre mim</h3><p className="profile-texto">{profile.bio || 'Conte um pouco sobre você editando seu perfil.'}</p></section></section>
            <ProfileEditor key={profile.id} profile={profile} onSaved={reload} />
            <ProfileTabs active={tab} onChange={setTab} />
            <ProfileContent key={tab} userId={profile.id} tab={tab} />
        </>}
    </AccountLayout>;
}
