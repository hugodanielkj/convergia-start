import Fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { dependenciasDeTeste, usuarioTeste } from '../testes/dependencias.js';
import { exigirAdmin, exigirUsuario, pluginAuth, semSessao, usuarioDaRequisicao } from './auth.js';
import { registrarTratamentoDeErros } from './erros.js';
import type { UsuarioAutenticado } from '@convergia/core/base';

function appCom(usuario: UsuarioAutenticado | null) {
  const app = Fastify();
  app.decorate('deps', dependenciasDeTeste({ resolverSessao: () => Promise.resolve(usuario) }));
  registrarTratamentoDeErros(app);
  void app.register(pluginAuth);
  void app.register(async (escopo) => {
    escopo.get('/privado', { preHandler: exigirUsuario }, (req) => ({
      id: usuarioDaRequisicao(req).id,
    }));
    escopo.get('/config', { preHandler: exigirAdmin }, () => ({ ok: true }));
    escopo.get('/sem-guarda', (req) => ({ id: usuarioDaRequisicao(req).id }));
  });
  return app;
}

describe('autenticação da equipe', () => {
  const anonimo = appCom(null);
  const admin = appCom(usuarioTeste({ id: 'adm', papel: 'admin' }));
  const membro = appCom(usuarioTeste({ id: 'mem', papel: 'membro' }));
  afterAll(() => Promise.all([anonimo.close(), admin.close(), membro.close()]));

  it('RN-01: sem sessão, rota privada responde 401', async () => {
    const r = await anonimo.inject('/privado');
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject({ erro: 'NAO_AUTENTICADO' });
  });

  it('com sessão, rota privada recebe o usuário', async () => {
    expect((await admin.inject('/privado')).json()).toEqual({ id: 'adm' });
  });

  it('RN-03: membro não acessa configurações', async () => {
    const r = await membro.inject('/config');
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ erro: 'RN-03' });
  });

  it('RN-03: admin acessa configurações', async () => {
    expect((await admin.inject('/config')).statusCode).toBe(200);
  });

  it('exigirAdmin sem sessão responde 401', async () => {
    expect((await anonimo.inject('/config')).statusCode).toBe(401);
  });

  it('usuarioDaRequisicao sem guarda e sem sessão responde 401', async () => {
    expect((await anonimo.inject('/sem-guarda')).statusCode).toBe(401);
  });

  it('semSessao nunca autentica', async () => {
    expect(await semSessao(undefined as never)).toBeNull();
  });
});
