import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, prismaDaRequisicao, usuarioDaRequisicao } from '../../base/auth.js';
import { cadastrarCliente, listarClientes } from './cadastrar-cliente.js';

// Limites só para barrar entradas absurdas; as regras de conteúdo são do core (RN-04, RN-05).
const corpoCadastro = z.object({
  nomeEmpresa: z.string().max(200),
  nomeContato: z.string().max(200),
  whatsapp: z.string().max(40).nullish(),
  email: z.string().max(320).nullish(),
  confirmarDuplicidade: z.boolean().default(false),
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
      },
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
      case 'criado':
        return reply.status(201).send({ cliente: resultado.cliente });
    }
  });

  app.get('/clientes', { preHandler: exigirUsuario }, async (request) => ({
    clientes: await listarClientes(prismaDaRequisicao(app, request)),
  }));

  return Promise.resolve();
}
