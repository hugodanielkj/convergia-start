import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { urlDoLink } from '../link/link-atual.js';
import { enfileirarConvite } from '../notificacoes/convite/convite.js';
import { cadastrarCliente, listarClientes } from './cadastrar-cliente.js';

// Limites só para barrar entradas absurdas; as regras de conteúdo são do core (RN-04, RN-05).
const corpoCadastro = z.object({
  nomeEmpresa: z.string().max(200),
  nomeContato: z.string().max(200),
  whatsapp: z.string().max(40).nullish(),
  email: z.string().max(320).nullish(),
  confirmarDuplicidade: z.boolean().default(false),
  responsavelId: z.string().min(1).max(64).optional(),
  // RN-09: o convite sai sozinho, a menos que a pessoa marque "Enviar convite depois".
  enviarConviteDepois: z.boolean().default(false),
});

/** Módulo clientes (S1-3): cadastro com validação e alerta de duplicidade, e lista. */
export default function clientes(app: FastifyInstance): Promise<void> {
  app.post('/clientes', { preHandler: exigirUsuario }, async (request, reply) => {
    const corpo = corpoCadastro.parse(request.body);
    const resultado = await cadastrarCliente(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      {
        nomeEmpresa: corpo.nomeEmpresa,
        nomeContato: corpo.nomeContato,
        whatsapp: corpo.whatsapp ?? undefined,
        email: corpo.email ?? undefined,
        confirmarDuplicidade: corpo.confirmarDuplicidade,
        responsavelId: corpo.responsavelId,
      },
      app.deps.relogio.agora(),
      app.deps.chaveLink,
    );

    switch (resultado.tipo) {
      case 'invalido':
        return reply.status(422).send({ erro: 'CADASTRO_INVALIDO', erros: resultado.erros });
      case 'duplicado':
        return reply.status(409).send({
          erro: 'RN-07',
          mensagem: 'Já existe cliente com este e-mail ou WhatsApp',
          duplicidades: resultado.duplicidades.map(({ cliente, motivos }) => ({
            clienteId: cliente.id,
            nomeEmpresa: cliente.nomeEmpresa,
            motivos,
          })),
        });
      case 'criado': {
        const onboardingId = resultado.cliente.onboarding?.id;
        const convite =
          corpo.enviarConviteDepois || !onboardingId
            ? null
            : {
                enviaEm: await enfileirarConvite(
                  prismaDaRequisicao(app, request),
                  {
                    eventos: app.deps.eventos,
                    urlApp: app.deps.auth.urlApp,
                    chaveLink: app.deps.chaveLink,
                  },
                  onboardingId,
                  urlDoLink(app.deps.auth.urlApp, resultado.link),
                  `convite:${onboardingId}:cadastro`,
                  app.deps.relogio.agora(),
                ),
              };
        return reply
          .status(201)
          .send({ cliente: resultado.cliente, link: resultado.link, convite });
      }
    }
  });

  app.get('/clientes', { preHandler: exigirUsuario }, async (request) => ({
    clientes: await listarClientes(prismaDaRequisicao(app, request)),
  }));

  return Promise.resolve();
}
