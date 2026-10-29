import { useEffect, useId, useRef, useState } from 'react';

// Campo que só vira editável ao clicar no lápis (como no protótipo).
// Enter salva, Esc cancela. "check" valida e normaliza: devolve { value } ou { error }.
export default function EditableField({ label, value, onSave, check, multiline = false, maxLength, placeholder, disabled = false }) {
    const id = useId();
    const fieldRef = useRef(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const Field = multiline ? 'textarea' : 'input';

    useEffect(() => { if (editing) fieldRef.current?.focus(); }, [editing]);

    function start() { setDraft(value ?? ''); setError(''); setEditing(true); }
    function cancel() { setEditing(false); setError(''); }

    async function submit(event) {
        event.preventDefault();
        if (!editing) return;
        const checked = check ? check(draft) : { value: draft };
        if (checked.error) { setError(checked.error); return; }
        setBusy(true); setError('');
        try { await onSave(checked.value); setEditing(false); }
        catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
        finally { setBusy(false); }
    }

    return <form className="config-row" onSubmit={submit} noValidate
        onKeyDown={(event) => { if (event.key === 'Escape' && editing) cancel(); }}>
        <label className="config-label" htmlFor={id}>{label}</label>
        <div className="config-field">
            <Field ref={fieldRef} id={id} className="config-input" rows={multiline ? 3 : undefined}
                value={editing ? draft : value ?? ''} readOnly={!editing} maxLength={maxLength}
                placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} />
            {editing ? <>
                <button type="submit" className="config-icon-btn" disabled={busy} aria-label={`Salvar ${label.replace(/:$/, '').toLowerCase()}`}>
                    <i className="bi bi-check-lg" aria-hidden="true"></i></button>
                <button type="button" className="config-icon-btn config-icon-btn--muted" disabled={busy} onClick={cancel} aria-label="Cancelar edição">
                    <i className="bi bi-x-lg" aria-hidden="true"></i></button>
            </> : <button type="button" className="config-icon-btn" disabled={disabled} onClick={start}
                aria-label={`Editar ${label.replace(/:$/, '').toLowerCase()}`}>
                <i className="bi bi-pencil-square" aria-hidden="true"></i></button>}
        </div>
        {error && <p className="config-error" role="alert">{error}</p>}
    </form>;
}
