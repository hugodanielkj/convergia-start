import type { Mensageria, MensagemSaida, ResultadoEnvio } from '@convergia/core/base';
import { destinoNoWhatsapp } from '@convergia/core/envio';
import { z } from 'zod';
import { TEMPO_LIMITE_MS, falhaDeRede, statusTemporario } from './http.js';

export interface OpcoesMegaApi {
  /** Host da instância, como no painel da MegaAPI (ex.: apinocode01.megaapi.com.br). */
  readonly host: string;
  readonly instanceKey: string;
  readonly token: string;
  readonly fetcher?: typeof fetch;
}

const sucesso = z.object({
  error: z.literal(false).optional(),
  messageData: z.object({ key: z.object({ id: z.string() }) }),
});
const falha = z.object({ message: z.string().optional() });

/**
 * WhatsApp pela MegaAPI (D-07), atrás da porta `Mensageria` (RN-71). Envio de texto:
 * POST https://<host>/rest/sendMessage/<instance_key>/text com `Authorization: Bearer <token>`.
 */
export function criarWhatsappMegaApi(opcoes: OpcoesMegaApi): Mensageria {
  const fetcher = opcoes.fetcher ?? fetch;
  const host = opcoes.host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const url = `https://${host}/rest/sendMessage/${encodeURIComponent(opcoes.instanceKey)}/text`;
  return {
    async enviar(mensagem: MensagemSaida): Promise<ResultadoEnvio> {
      let resposta: Response;
      try {
        resposta = await fetcher(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opcoes.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            messageData: { to: destinoNoWhatsapp(mensagem.destinatario), text: mensagem.corpo },
          }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch (erro) {
        return falhaDeRede(erro, 'megaapi');
      }
      const corpo: unknown = await resposta.json().catch(() => null);
      const ok = sucesso.safeParse(corpo);
      if (resposta.ok && ok.success) return { ok: true, idExterno: ok.data.messageData.key.id };
      const detalhe = falha.safeParse(corpo).data?.message ?? 'resposta inesperada';
      return {
        ok: false,
        erro: `megaapi ${String(resposta.status)}: ${detalhe}`,
        // 200 com `error: true` (ex.: número sem WhatsApp) não melhora com o tempo.
        temporario: !resposta.ok && statusTemporario(resposta.status),
      };
    },
  };
}
