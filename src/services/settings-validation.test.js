// Rodar com: node --test src/services/settings-validation.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAvatarFile, checkBio, checkDisplayName, checkEmail, checkFavorite, checkPasswordChange,
    checkResetPassword, checkSignupUsername, checkSocial, checkUsername } from './settings-validation.js';

test('nome de exibição: obrigatório e com limite', () => {
    assert.equal(checkDisplayName('  Ana  ').value, 'Ana');
    assert.ok(checkDisplayName('   ').error);
    assert.ok(checkDisplayName('a'.repeat(101)).error);
});

test('nome de usuário: 3 a 30 caracteres, vazio remove', () => {
    assert.equal(checkUsername('@ana_01').value, 'ana_01');
    assert.equal(checkUsername('').value, null);
    for (const bad of ['ab', 'ana silva', 'ana-silva', 'ç'.repeat(5), 'a'.repeat(31)]) assert.ok(checkUsername(bad).error, bad);
});

test('cadastro: nome de usuário é obrigatório e segue o mesmo formato', () => {
    assert.equal(checkSignupUsername(' @Ana_01 ').value, 'Ana_01');
    for (const bad of ['', '   ', 'ab', 'ana silva', 'ana@email.com', 'a'.repeat(31)]) assert.ok(checkSignupUsername(bad).error, bad);
});

test('bio: vazio vira null e respeita 1000 caracteres', () => {
    assert.equal(checkBio('  ').value, null);
    assert.equal(checkBio(' oi ').value, 'oi');
    assert.ok(checkBio('x'.repeat(1001)).error);
});

test('e-mail: formato e diferente do atual', () => {
    assert.equal(checkEmail(' Novo@Email.com ', 'velho@email.com').value, 'novo@email.com');
    assert.ok(checkEmail('sem-arroba', 'a@a.com').error);
    assert.ok(checkEmail('A@A.com', 'a@a.com').error);
});

test('senha: exige atual, mínimo de 8 e diferente da atual', () => {
    assert.ok(checkPasswordChange('', 'novasenha1').error);
    assert.ok(checkPasswordChange('antiga123', 'curta').error);
    assert.ok(checkPasswordChange('mesma1234', 'mesma1234').error);
    assert.deepEqual(checkPasswordChange('antiga123', 'novasenha1'), {});
});

test('esqueci a senha: e-mail sem comparar com o atual, e nova senha com confirmação', () => {
    assert.equal(checkEmail(' Ana@Email.com ').value, 'ana@email.com');
    assert.ok(checkEmail('').error);
    assert.ok(checkResetPassword('curta', 'curta').error);
    assert.ok(checkResetPassword('novasenha1', 'outrasenha1').error);
    assert.deepEqual(checkResetPassword('novasenha1', 'novasenha1'), {});
});

test('jogos favoritos: limite de 5, sem repetir', () => {
    assert.equal(checkFavorite('  Hollow   Knight ', []).value, 'Hollow Knight');
    assert.ok(checkFavorite('hollow knight', ['Hollow Knight']).error);
    assert.ok(checkFavorite('Outro', ['1', '2', '3', '4', '5']).error);
    assert.ok(checkFavorite('', []).error);
});

test('redes sociais: só https e domínio da rede', () => {
    assert.equal(checkSocial('github', 'github.com/ana').value.url, 'https://github.com/ana');
    assert.equal(checkSocial('github', 'https://www.github.com/ana').value.rede, 'github');
    assert.equal(checkSocial('site', 'https://meusite.dev').value.url, 'https://meusite.dev/');
    const rejected = [
        ['github', 'javascript:alert(1)'], ['github', 'http://github.com/ana'], ['github', 'https://evil.com/github.com'],
        ['github', 'https://github.com.evil.com/ana'], ['github', 'https://ana:senha@github.com/ana'], ['site', 'https://localhost'],
        ['invalida', 'https://github.com/ana'], ['github', ''],
    ];
    for (const [network, url] of rejected) assert.ok(checkSocial(network, url, []).error, `${network} ${url}`);
    assert.ok(checkSocial('github', 'github.com/ana', [{ rede: 'github', url: 'https://github.com/x' }]).error);
});

test('foto: tipo e tamanho', () => {
    assert.equal(checkAvatarFile({ type: 'image/png', size: 1000 }), '');
    assert.ok(checkAvatarFile({ type: 'image/gif', size: 1000 }));
    assert.ok(checkAvatarFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }));
    assert.ok(checkAvatarFile(null));
});
