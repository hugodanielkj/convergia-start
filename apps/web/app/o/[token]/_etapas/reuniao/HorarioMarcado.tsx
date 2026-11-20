import type { ReactNode } from 'react';
import { formatarDiaEHora, partesDoInstante } from './formatar';
import estilos from './reuniao.module.css';

/**
 * Horário já marcado (reunião ou captação), no fuso do cliente (RN-32): a data fica em destaque,
 * como um bilhete, e o texto completo vem ao lado. Sem fuso ainda (antes de hidratar), só "…".
 */
export function HorarioMarcado({
  rotulo,
  instante,
  fuso,
  children,
}: {
  /** "Sua reunião online está marcada para" */
  rotulo: string;
  instante: string;
  fuso: string | null;
  children?: ReactNode;
}) {
  const partes = fuso === null ? null : partesDoInstante(instante, fuso);
  return (
    <div className={estilos.marcado}>
      <span className={estilos.data} aria-hidden="true">
        <span className={estilos.semana}>{partes?.semana ?? '…'}</span>
        <span className={estilos.numero}>{partes?.dia ?? ''}</span>
        <span className={estilos.mes}>{partes?.mes ?? ''}</span>
      </span>
      <div className={estilos.quando}>
        <p className={estilos.ajuda}>{rotulo}</p>
        <p>
          <strong>
            <time dateTime={instante}>
              {fuso === null ? '…' : formatarDiaEHora(instante, fuso)}
            </time>
          </strong>
        </p>
        {fuso !== null && <p className={estilos.ajuda}>Fuso {fuso.replaceAll('_', ' ')}</p>}
        {children}
      </div>
    </div>
  );
}
