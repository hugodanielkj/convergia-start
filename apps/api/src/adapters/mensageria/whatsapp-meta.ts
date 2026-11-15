import type { Mensageria, MensagemSaida, ResultadoEnvio } from '@convergia/core/base';
import { z } from 'zod';
import { TEMPO_LIMITE_MS, falhaDeRede, statusTemporario } from './http.js';

export interface OpcoesWhatsappMeta {
  readonly token: string;
  readonly phoneNumberId: string;
  /** Versão da Graph API (ex.: v21.0). */
  readonly versaoApi: string;
  /** Tipo do template do app (convite, lembrete_pendencia...) → nome do template aprovado na Meta. */
  readonly templates: Readonly<Record<string, string>>;
  /** Usado quando o tipo não tem template próprio. */
  readonly templatePadrao: string | undefined;
  readonly idioma: string;
  readonly fetcher?: typeof fetch;
}

const sucesso = z.object({ messages: z.array(z.object({ id: z.string() })).min(1) });
const falha = z.object({
  error: z.object({ code: z.number().optional(), message: z.string().optional() }),
});

/**
 * Códigos da Meta que passam com o tempo (limite de envio, serviço indisponível). Os demais
 * (número sem WhatsApp, template inexistente ou com parâmetro errado, fora da janela de 24h,
 * token inválido) não melhoram sozinhos: seguem para o outro canal (RN-60).
 */
const CODIGOS_TEMPORARIOS: ReadonlySet<number> = new Set([
  1, 2, 4, 17, 341, 80007, 130429, 131016, 131056,
]);

/** Meta recusa quebra de linha, tab e 4+ espaços seguidos dentro de parâmetro de template. */
const LIMITE_PARAMETRO = 1024;
const limparParametro = (texto: string): string =>
  texto.replace(/\s+/g, ' ').trim().slice(0, LIMITE_PARAMETRO);

/** E.164 sem "+" (formato do campo `to` da Cloud API). */
export const normalizarTelefoneMeta = (telefone: string): string => telefone.replace(/\D/g, '');

/** Lê "tipo=nome,tipo=nome" (variável META_WHATSAPP_TEMPLATES). */
export function lerMapaDeTemplates(texto: string | undefined): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const par of (texto ?? '').split(',')) {
    const [tipo, nome] = par.split('=').map((p) => p.trim());
    if (tipo && nome) mapa[tipo] = nome;
  }
  return mapa;
}

/**
 * WhatsApp pela API oficial (Cloud API) atrás da porta `Mensageria` (RN-61, RN-71). Mensagem iniciada
 * pela empresa só pode ser template aprovado: o texto já preenchido vai inteiro no parâmetro {{1}}
 * do template do tipo (ver decisão `a-whatsapp-api-oficial`).
 */
export function criarWhatsappMeta(opcoes: OpcoesWhatsappMeta): Mensageria {
  const fetcher = opcoes.fetcher ?? fetch;
  const url = `https://graph.facebook.com/${opcoes.versaoApi}/${encodeURIComponent(opcoes.phoneNumberId)}/messages`;
  return {
    async enviar(mensagem: MensagemSaida): Promise<ResultadoEnvio> {
      const tipo = mensagem.tipo ?? '';
      const nomeTemplate = opcoes.templates[tipo] ?? opcoes.templatePadrao;
      if (!nomeTemplate) {
        return { ok: false, erro: `meta: sem_template_para_${tipo}`, temporario: false };
      }
      let resposta: Response;
      try {
        resposta = await fetcher(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opcoes.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalizarTelefoneMeta(mensagem.destinatario),
            type: 'template',
            template: {
              name: nomeTemplate,
              language: { code: opcoes.idioma },
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: limparParametro(mensagem.corpo) }],
                },
              ],
            },
          }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch (erro) {
        return falhaDeRede(erro, 'meta');
      }
      const corpo: unknown = await resposta.json().catch(() => null);
      const ok = sucesso.safeParse(corpo);
      if (resposta.ok && ok.success) return { ok: true, idExterno: ok.data.messages[0]?.id ?? '' };
      const erro = falha.safeParse(corpo).data?.error;
      const detalhe = (erro?.message ?? 'resposta inesperada').slice(0, 150);
      const codigo = erro?.code;
      return {
        ok: false,
        erro: `meta ${String(codigo ?? resposta.status)}: ${detalhe}`,
        temporario:
          !resposta.ok &&
          (statusTemporario(resposta.status) ||
            (codigo !== undefined && CODIGOS_TEMPORARIOS.has(codigo))),
      };
    },
  };
}
