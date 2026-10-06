import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '../services/api';

export function useApi(path) {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState({ key: '', data: null, error: null });
    const key = `${path}#${attempt}`;

    useEffect(() => {
        const controller = new AbortController();
        requestJson(path, { signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) setResult({ key, data, error: null });
            })
            .catch((error) => {
                if (!controller.signal.aborted) setResult({ key, data: null, error: error.message });
            });
        return () => controller.abort();
    }, [key, path]);

    const reload = useCallback(() => setAttempt((value) => value + 1), []);
    return result.key === key
        ? { data: result.data, error: result.error, loading: false, reload }
        : { data: null, error: null, loading: true, reload };
}
