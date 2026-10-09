import { ApiError } from './errors.js';

export function invalid(message) {
    throw new ApiError(400, 'INVALID_QUERY', message);
}

export function text(value, name, maxLength = 200) {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length > maxLength) {
        invalid(`${name} deve ser um texto de até ${maxLength} caracteres.`);
    }
    return value.trim();
}

export function integer(value, name, fallback, max = 10000) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
        invalid(`${name} deve ser um inteiro entre 1 e ${max}.`);
    }
    return Number(value);
}

export function gameId(value) {
    return integer(value, 'id', undefined, Number.MAX_SAFE_INTEGER);
}

function boolean(value, name) {
    if (value === undefined) return false;
    if (!['true', 'false', '1', '0'].includes(value)) invalid(`${name} deve ser true ou false.`);
    return value === 'true' || value === '1';
}

export function searchQuery(query) {
    const params = listQuery(query);
    params.sort = text(query.sort, 'sort') || (query.ordering ? 'ordering' : 'relevance');
    if (!['relevance', 'popular', 'rating', 'name', 'ordering'].includes(params.sort)) invalid('sort contém uma ordenação inválida.');
    params.hide_extras = boolean(query.hide_extras, 'hide_extras');
    params.batch = integer(query.batch, 'batch', 1, 20);
    return params;
}

function validDate(value) {
    const date = new Date(`${value}T00:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function listQuery(query) {
    if (query.key !== undefined) invalid('A chave RAWG é configurada apenas no servidor.');
    const params = {
        page: integer(query.page, 'page', 1),
        page_size: integer(query.page_size, 'page_size', 20, 48),
        ordering: text(query.ordering, 'ordering') || '-added',
    };
    if (!params.ordering.split(',').every((field) => /^-?(name|released|added|created|updated|rating|metacritic)$/.test(field))) {
        invalid('ordering contém um campo de ordenação inválido.');
    }
    const search = text(query.search, 'search');
    if (search) params.search = search;
    for (const name of ['genres', 'platforms', 'parent_platforms', 'developers', 'tags']) {
        const value = text(query[name], name);
        if (value) {
            if (['platforms', 'parent_platforms'].includes(name) && !/^[1-9]\d*(,[1-9]\d*)*$/.test(value)) invalid(`${name} deve conter IDs numéricos separados por vírgula.`);
            if (!/^[a-z0-9-]+(,[a-z0-9-]+)*$/i.test(value)) invalid(`${name} deve conter IDs ou slugs separados por vírgula.`);
            params[name] = value;
        }
    }
    const dates = text(query.dates, 'dates');
    if (dates) {
        const [start, end, extra] = dates.split(',');
        if (extra || !validDate(start) || !validDate(end) || start > end) invalid('dates deve ser início,fim no formato AAAA-MM-DD.');
        params.dates = dates;
    }
    const metacritic = text(query.metacritic, 'metacritic');
    if (metacritic) {
        const values = metacritic.split(',');
        const [min, max] = values.map(Number);
        if (values.length !== 2 || !values.every((value) => /^\d{1,3}$/.test(value)) || min > max || max > 100) {
            invalid('metacritic deve ser mínimo,máximo entre 0 e 100.');
        }
        params.metacritic = metacritic;
    }
    return params;
}
