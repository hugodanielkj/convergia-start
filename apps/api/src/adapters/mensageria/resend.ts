import type { Mensageria, MensagemSaida, ResultadoEnvio } from '@convergia/core/base';
import { z } from 'zod';
import { TEMPO_LIMITE_MS, falhaDeRede, statusTemporario } from './http.js';

export interface OpcoesResend {
  readonly apiKey: string;
  /** Remetente verificado no Resend, ex.: "Agência <contato@agencia.com.br>". */
  readonly remetente: string;
  /** Assunto quando a mensagem não traz um (o WhatsApp não usa assunto). */
  readonly assuntoPadrao: string;
  readonly fetcher?: typeof fetch;
}

const URL_RESEND = 'https://api.resend.com/emails';
const sucesso = z.object({ id: z.string() });
const falha = z.object({ message: z.string().optional() });

/** E-mail pelo Resend (decisão do PO na S5-2), atrás da porta `Mensageria` (RN-71). Só texto. */
export function criarEmailResend(opcoes: OpcoesResend): Mensageria {
  const fetcher = opcoes.fetcher ?? fetch;
  return {
    async enviar(mensagem: MensagemSaida): Promise<ResultadoEnvio> {
      let resposta: Response;
      try {
        resposta = await fetcher(URL_RESEND, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opcoes.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: opcoes.remetente,
            to: [mensagem.destinatario],
            subject: mensagem.assunto ?? opcoes.assuntoPadrao,
            text: mensagem.corpo,
          }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
      } catch (erro) {
        return falhaDeRede(erro, 'resend');
      }
      const corpo: unknown = await resposta.json().catch(() => null);
      const ok = sucesso.safeParse(corpo);
      if (resposta.ok && ok.success) return { ok: true, idExterno: ok.data.id };
      const detalhe = falha.safeParse(corpo).data?.message ?? 'resposta inesperada';
      return {
        ok: false,
        erro: `resend ${String(resposta.status)}: ${detalhe}`,
        temporario: statusTemporario(resposta.status),
      };
    },
  };
}
