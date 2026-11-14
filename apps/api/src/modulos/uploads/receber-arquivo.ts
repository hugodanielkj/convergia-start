import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '@convergia/core/base';
import { CONFIG_PADRAO, NaoEncontradoError } from '@convergia/core/base';
import {
  chaveDoArquivo,
  validarUpload,
  type Armazenamento,
  type ConfigUpload,
  type ErroUpload,
} from '@convergia/core/uploads';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export interface ArquivoEnviado {
  readonly id: string;
  readonly nome: string;
  readonly tipo: string;
  readonly tamanho: number;
  readonly criadoEm: Date;
}

export type ResultadoEnvio =
  | { readonly tipo: 'recebido'; readonly arquivo: ArquivoEnviado }
  | { readonly tipo: 'recusado'; readonly erro: ErroUpload };

/** Limite e tipos da agência (RN-20); sem configuração gravada, vale o padrão. */
export async function configDeUpload(prisma: PrismaDaAgencia): Promise<ConfigUpload> {
  const config = await prisma.configAgencia.findFirst();
  return {
    tamanhoMaxMb: config?.uploadTamanhoMaxMb ?? CONFIG_PADRAO.uploadTamanhoMaxMb,
    tiposPermitidos: config?.uploadTiposPermitidos ?? CONFIG_PADRAO.uploadTiposPermitidos,
  };
}

/**
 * Valida (RN-20), guarda no storage por agência/cliente (RN-69) e registra metadados e
 * auditoria (RN-77). Reutilizável pela rota pública do cliente na S2-3.
 */
export async function receberArquivo(
  prisma: PrismaDaAgencia,
  armazenamento: Armazenamento,
  usuario: UsuarioAutenticado,
  entrada: {
    clienteId: string;
    nome: string;
    tipoDeclarado: string | undefined;
    conteudo: Buffer;
  },
  config: ConfigUpload,
): Promise<ResultadoEnvio> {
  const cliente = await prisma.cliente.findFirst({ where: { id: entrada.clienteId } });
  if (!cliente) throw new NaoEncontradoError('Cliente');

  const validacao = validarUpload(
    {
      nome: entrada.nome,
      tipoDeclarado: entrada.tipoDeclarado,
      tamanho: entrada.conteudo.length,
      inicio: entrada.conteudo.subarray(0, 16),
    },
    config,
  );
  if (!validacao.ok) return { tipo: 'recusado', erro: validacao.erro };

  const id = randomUUID();
  const chave = chaveDoArquivo({
    agenciaId: usuario.agenciaId,
    clienteId: cliente.id,
    arquivoId: id,
    tipo: validacao.tipo,
  });
  await armazenamento.guardar(chave, entrada.conteudo, validacao.tipo);
  try {
    const [arquivo] = await prisma.$transaction([
      prisma.arquivo.create({
        data: {
          id,
          agenciaId: usuario.agenciaId,
          clienteId: cliente.id,
          nomeOriginal: validacao.nome,
          tipo: validacao.tipo,
          tamanho: entrada.conteudo.length,
          chave,
        },
      }),
      prisma.auditoriaLog.create({
        data: {
          agenciaId: usuario.agenciaId,
          ator: `usuario:${usuario.id}`,
          acao: 'arquivo.enviado',
          entidade: 'Arquivo',
          entidadeId: id,
          dados: { tipo: validacao.tipo, tamanho: entrada.conteudo.length },
        },
      }),
    ]);
    return {
      tipo: 'recebido',
      arquivo: {
        id: arquivo.id,
        nome: arquivo.nomeOriginal,
        tipo: arquivo.tipo,
        tamanho: arquivo.tamanho,
        criadoEm: arquivo.criadoEm,
      },
    };
  } catch (erro) {
    await armazenamento.apagar(chave); // não deixa arquivo órfão no storage
    throw erro;
  }
}
