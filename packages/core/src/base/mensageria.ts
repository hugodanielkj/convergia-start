export type Canal = 'whatsapp' | 'email';

export interface MensagemSaida {
  canal: Canal;
  /** E.164 para WhatsApp, endereço para e-mail. */
  destinatario: string;
  assunto?: string;
  corpo: string;
}

export type ResultadoEnvio =
  { ok: true; idExterno: string } | { ok: false; erro: string; temporario: boolean };

/** Porta de envio de mensagens (RN-68, RN-71). Implementações ficam em `apps/api/src/adapters`. */
export interface Mensageria {
  enviar(mensagem: MensagemSaida): Promise<ResultadoEnvio>;
}
