import { z } from 'zod';

const esquema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({
                statuses: z
                  .array(
                    z.object({
                      id: z.string(),
                      status: z.string(),
                      errors: z.array(z.object({ code: z.number().optional() })).optional(),
                    }),
                  )
                  .optional(),
                messages: z
                  .array(
                    z.object({
                      from: z.string(),
                      type: z.string(),
                      text: z.object({ body: z.string() }).optional(),
                    }),
                  )
                  .optional(),
              }),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export interface FalhaDeEntrega {
  readonly idExterno: string;
  readonly codigo: number | undefined;
}
export interface EventosMeta {
  readonly falhas: FalhaDeEntrega[];
  /** Telefones (só dígitos) de quem pediu para parar. */
  readonly optOuts: string[];
}

const PEDIDO_DE_PARAR = /^\s*(parar|pare|sair|stop|cancelar|descadastrar)\s*[.!]?\s*$/i;

/** Extrai do payload o que importa: entregas que falharam e pedidos de "PARAR" (RN-61). */
export function eventosDoPayload(payload: unknown): EventosMeta {
  const lido = esquema.safeParse(payload);
  const falhas: FalhaDeEntrega[] = [];
  const optOuts: string[] = [];
  if (!lido.success) return { falhas, optOuts };
  for (const entrada of lido.data.entry) {
    for (const { value } of entrada.changes) {
      for (const s of value.statuses ?? []) {
        if (s.status === 'failed') falhas.push({ idExterno: s.id, codigo: s.errors?.[0]?.code });
      }
      for (const m of value.messages ?? []) {
        if (m.type === 'text' && m.text && PEDIDO_DE_PARAR.test(m.text.body)) {
          optOuts.push(m.from.replace(/\D/g, ''));
        }
      }
    }
  }
  return { falhas, optOuts };
}
