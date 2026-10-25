export function authErrorMessage(error) {
    const messages = {
        invalid_credentials: 'E-mail ou senha incorretos.',
        email_not_confirmed: 'Esta conta ainda está com confirmação de e-mail pendente. Peça ao responsável pelo site para regularizar o acesso.',
        signup_confirmation_required: 'O cadastro sem confirmação de e-mail ainda precisa ser liberado pelo responsável pelo site.',
        user_already_exists: 'Este e-mail já está cadastrado. Entre na sua conta.',
        weak_password: 'Use uma senha mais forte, com pelo menos 8 caracteres.',
        email_address_invalid: 'Preencha um endereço de e-mail válido.',
        email_address_not_authorized: 'O cadastro sem confirmação de e-mail ainda precisa ser liberado pelo responsável pelo site.',
        email_provider_disabled: 'O acesso por e-mail está desativado no projeto. Avise o responsável pelo site.',
        signup_disabled: 'O cadastro está temporariamente desativado. Avise o responsável pelo site.',
        over_email_send_rate_limit: 'O limite de envio de e-mails foi atingido. Aguarde um pouco e tente novamente.',
        over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.',
        otp_expired: 'O link de confirmação expirou ou já foi usado. Tente entrar com seu e-mail e senha.',
        session_expired: 'Sua sessão expirou. Entre novamente.',
        refresh_token_not_found: 'Sua sessão expirou. Entre novamente.',
        refresh_token_already_used: 'Sua sessão expirou. Entre novamente.',
        captcha_failed: 'A verificação de segurança não foi concluída. Tente novamente.',
    };
    if (messages[error?.code]) return messages[error.code];
    if (error?.name === 'AuthRetryableFetchError')
        return 'Não foi possível acessar o serviço de login. Verifique sua internet; se continuar, avise o responsável para conferir se o Supabase está ativo.';
    if (error?.status === 429) return messages.over_request_rate_limit;
    if (error?.code === 'unexpected_failure' && /email/i.test(error.message || ''))
        return 'O cadastro ainda depende de confirmação de e-mail. Avise o responsável para liberar o cadastro sem confirmação.';
    return null;
}

export function safeAuthDestination(requested) {
    if (typeof requested !== 'string' || !/^\/(?!\/)/.test(requested) || /[\\\r\n\t]/.test(requested)) return '/perfil';
    try {
        const pathname = decodeURIComponent(new URL(requested, 'https://gameatlas.invalid').pathname);
        if (/[\\\r\n\t]/.test(pathname) || /^\/(login|cadastro)(\/|$)/i.test(pathname)) return '/perfil';
        return requested;
    } catch { return '/perfil'; }
}

export function confirmationRedirect(origin) { return new URL('/perfil', origin).href; }

export function confirmationError(location) {
    const params = [new URLSearchParams(location?.search || ''), new URLSearchParams((location?.hash || '').replace(/^#/, ''))];
    const error = params.map((param) => param.get('error_code') || param.get('error')).find(Boolean);
    return error ? authErrorMessage({ code: error }) || 'Não foi possível confirmar o acesso. Tente entrar com seu e-mail e senha.' : null;
}

// Eventos reais de login/saída prevalecem sobre a leitura inicial da sessão.
export function observeAuthSession(auth, onState, initialError = null, { timeoutMs = 15000 } = {}) {
    let active = true;
    let revision = 0;
    let initialTimer;
    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        revision += 1;
        clearTimeout(initialTimer);
        if (active) onState({ session, loading: false, error: null });
    });
    const initialRevision = 0;
    initialTimer = setTimeout(() => {
        if (active && revision === initialRevision) onState({ session: null, loading: false,
            error: initialError || 'A verificação da sessão demorou demais. Tente entrar novamente e confira se o serviço de login está disponível.' });
    }, timeoutMs);
    Promise.resolve().then(() => auth.getSession()).then(({ data, error }) => {
        clearTimeout(initialTimer);
        if (active && revision === initialRevision) onState({ session: error ? null : data.session,
            loading: false, error: initialError || (error ? authErrorMessage(error) || 'Não foi possível recuperar sua sessão. Entre novamente.' : null) });
    }).catch((error) => {
        clearTimeout(initialTimer);
        if (active && revision === initialRevision) onState({ session: null, loading: false,
            error: initialError || authErrorMessage(error) || 'Não foi possível recuperar sua sessão. Entre novamente.' });
    });
    return () => { active = false; clearTimeout(initialTimer); subscription.unsubscribe(); };
}

export async function registerWithPassword(auth, { email, password, name }) {
    const nome = name.trim();
    if (!nome) throw new Error('Preencha seu nome de exibição.');
    const { data, error } = await auth.signUp({ email: email.trim(), password,
        options: { data: { nome } } });
    if (error) throw error;
    if (!data?.session) {
        const pending = new Error(authErrorMessage({ code: 'signup_confirmation_required' }));
        pending.code = 'signup_confirmation_required';
        throw pending;
    }
    return data;
}

export async function loginWithPassword(auth, { email, password }) {
    const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    if (!data.session) throw new Error('Não foi possível iniciar sua sessão. Tente novamente.');
    return data;
}
