import express from 'express';
import cors from 'cors';
import { ApiError } from './errors.js';
import { gameId, integer, invalid, listQuery, searchQuery, text } from './validation.js';

export function createApp({ rawg, supabaseService, accountService, corsOrigins = [] }) {
    const app = express();
    app.disable('x-powered-by');
    app.use(cors({ origin: corsOrigins }));
    app.use(['/api/auth', '/api/conta', '/api/perfis', '/api/reviews', '/api/usuarios'], (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });

    app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'GameAtlas API' }));

    app.post('/api/biblioteca/jogos/:id', async (req, res) => {
        const id = gameId(req.params.id);
        if (!supabaseService) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'A conexão com o banco ainda não está configurada.');
        res.json(await supabaseService.linkGame(req.get('authorization'), id, rawg));
    });

    // Em produção, atrás de proxy, configure app.set('trust proxy', ...) para o limite de tentativas enxergar o IP real.
    app.post('/api/auth/entrar', express.json({ limit: '2kb' }), async (req, res) => {
        if (!supabaseService) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'A conexão com o banco ainda não está configurada.');
        res.json(await supabaseService.loginWithUsername(req.ip, req.body));
    });

    const accounts = () => {
        if (!accountService) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'A conexão com o banco ainda não está configurada.');
        return accountService;
    };
    app.get('/api/usuarios/disponibilidade', async (req, res) => {
        res.json(await accounts().usernameAvailable(req.query.username));
    });
    for (const kind of ['reviews','listas']) app.get(`/api/perfis/:id/${kind}`, async (req, res) => {
        res.json(await accounts().profileContent(kind, req.params.id, req.query, req.get('authorization')));
    });
    for (const method of ['post','delete']) app[method]('/api/reviews/:id/curtida', async (req, res) => {
        res.json(await accounts().likeReview(req.get('authorization'), req.params.id, method === 'post'));
    });
    app.post('/api/conta/desativar', express.json({ limit: '2kb' }), async (req, res) => {
        res.json(await accounts().deactivate(req.get('authorization'), req.body));
    });

    app.get('/api/jogos', async (req, res) => {
        res.json(await rawg.listGames(req.query.search ? searchQuery(req.query) : listQuery(req.query)));
    });

    // As rotas fixas vêm antes de /:id para não serem interpretadas como IDs.
    app.get('/api/jogos/busca', async (req, res) => {
        const search = text(req.query.q, 'q');
        if (!search) invalid('Informe o parâmetro q para realizar a busca.');
        res.json(await rawg.listGames({ ...searchQuery(req.query), search }));
    });

    app.get('/api/jogos/categorias', async (req, res) => {
        const allowed = ['emAlta', 'melhoresAv', 'lancamentos', 'classicos', 'indie', 'multiplayer'];
        const include = text(req.query.include, 'include');
        const keys = include === undefined ? allowed : [...new Set(include.split(','))];
        if (!keys.length || keys.some((key) => !allowed.includes(key))) invalid('include contém uma categoria inválida.');
        res.json(await rawg.categories(keys));
    });

    app.get('/api/jogos/:id', async (req, res) => {
        res.json(await rawg.getGame(gameId(req.params.id)));
    });

    for (const [path, resource] of [['generos', 'genres'], ['plataformas', 'platforms']]) {
        app.get(`/api/${path}`, async (req, res) => {
            res.json(await rawg.metadata(resource, {
                page: integer(req.query.page, 'page', 1),
                page_size: integer(req.query.page_size, 'page_size', 40, 40),
            }));
        });
    }

    app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada.', code: 'NOT_FOUND' }));
    app.use((error, _req, res, next) => {
        if (res.headersSent) return next(error);
        if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
            return res.status(400).json({ erro: 'Dados inválidos.', code: 'INVALID_BODY' });
        }
        const known = error instanceof ApiError;
        res.status(known ? error.status : 500).json({
            erro: known ? error.message : 'Erro interno ao processar a solicitação.',
            code: known ? error.code : 'INTERNAL_ERROR',
        });
    });
    return app;
}
