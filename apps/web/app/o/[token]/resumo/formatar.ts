import { z } from 'zod';

export type EtapaResumo = 'formulario' | 'acessos' | 'reuniao' | 'captacao';

/** Resposta de GET /publico/onboardings/:token/resumo (apps/api/src/modulos/resumo). */
export const esquemaResumo = z.object({
  empresa: z.string(),
  fuso: z.string(),
  etapas: z.array(
    z.object({
      etapa: z.enum(['formulario', 'acessos', 'reuniao', 'captacao']),
      em: z.string().nullable(),
    }),
  ),
  primeiroConteudoEm: z.string().nullable(),
  concluidoEm: z.string().nullable(),
});

export type Resumo = z.infer<typeof esquemaResumo>;

export const ROTULO_ETAPA: Record<EtapaResumo, string> = {
  formulario: 'Formulário',
  acessos: 'Acessos',
  reuniao: 'Reunião',
  captacao: 'Captação',
};

/** "10 de nov. de 2026", no fuso da agência (D-14). */
export function formatarDia(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** "14:00", no fuso da agência. */
function formatarHora(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** O que aparece abaixo do nome da etapa no resumo (RN-14). */
export function descreverDataEtapa(etapa: EtapaResumo, iso: string | null, fuso: string): string {
  if (iso === null) return 'Concluída';
  const dia = formatarDia(iso, fuso);
  switch (etapa) {
    case 'formulario':
      return `Enviado em ${dia}`;
    case 'acessos':
      return `Concedidos em ${dia}`;
    case 'reuniao':
    case 'captacao':
      return `${dia}, às ${formatarHora(iso, fuso)}`;
  }
}
