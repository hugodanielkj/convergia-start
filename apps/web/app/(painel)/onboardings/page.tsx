import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { URL_API } from '../../_lib/url-api';
import { formatarDataHora } from '../clientes/formatar';
import { rotuloEtapa, rotuloStatusOnboarding } from '../clientes/mensagens';
import { LegendaProgresso, ProgressoEtapas } from './ProgressoEtapas';
import estilos from './onboardings.module.css';
import {
  ROTULO_ATENCAO,
  ROTULO_PRAZO,
  consultaDosFiltros,
  formatarDataDoPrazo,
  type RespostaPainel,
} from './tipos';

export const metadata: Metadata = { title: 'Onboardings · Convergia Start' };
export const dynamic = 'force-dynamic';

const STATUS = [
  'criado',
  'convite_enviado',
  'em_andamento',
  'aguardando_agendamentos',
  'aguardando_reuniao',
  'aguardando_captacao',
  'em_producao',
  'primeiro_conteudo_entregue',
  'concluido',
  'pausado',
  'cancelado',
];
const ETAPAS = ['formulario', 'acessos', 'reuniao', 'captacao'];

export default async function PaginaOnboardings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filtros, consulta } = consultaDosFiltros(await searchParams);
  const resposta = await fetch(`${URL_API}/painel/onboardings${consulta ? `?${consulta}` : ''}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} no painel`);
  const { onboardings, limitado, responsaveis } = (await resposta.json()) as RespostaPainel;
  const filtrando = consulta !== '';

  return (
    <>
      <h1>Onboardings</h1>
      {/* Mobile-first: os 7 filtros ocupavam a tela inteira do celular; ficam recolhidos. */}
      <details className={estilos.caixaFiltros} open={filtrando}>
        <summary>{filtrando ? 'Filtros (ativos)' : 'Filtros'}</summary>
        <form method="get" className={estilos.filtros} aria-label="Filtros">
          <label>
            Status
            <select name="status" defaultValue={filtros.status ?? ''}>
              <option value="">Todos</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {rotuloStatusOnboarding(s)}
                </option>
              ))}
            </select>
          </label>
          {responsaveis.length > 1 && (
            <label>
              Responsável
              <select name="responsavelId" defaultValue={filtros.responsavelId ?? ''}>
                <option value="">Todos</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Etapa pendente
            <select name="etapaPendente" defaultValue={filtros.etapaPendente ?? ''}>
              <option value="">Qualquer</option>
              {ETAPAS.map((e) => (
                <option key={e} value={e}>
                  {rotuloEtapa(e)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Criado de
            <input type="date" name="de" defaultValue={filtros.de ?? ''} />
          </label>
          <label>
            até
            <input type="date" name="ate" defaultValue={filtros.ate ?? ''} />
          </label>
          <label>
            Atenção
            <select name="atencao" defaultValue={filtros.atencao ?? ''}>
              <option value="">Todos</option>
              <option value="qualquer">Qualquer alerta</option>
              {Object.entries(ROTULO_ATENCAO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prazo
            <select name="prazo" defaultValue={filtros.prazo ?? ''}>
              <option value="">Todos</option>
              {Object.entries(ROTULO_PRAZO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
          <div className={estilos.botoes}>
            <button type="submit">Filtrar</button>
            {filtrando && (
              <Link href="/onboardings" className={estilos.limpar}>
                Limpar
              </Link>
            )}
          </div>
        </form>
      </details>

      {onboardings.length === 0 ? (
        <p className={estilos.vazio}>
          {filtrando
            ? 'Nenhum onboarding com esses filtros.'
            : 'Nenhum onboarding ainda. Cadastre um cliente para começar.'}
        </p>
      ) : (
        <>
          <LegendaProgresso />
          {/* Celular e tablet: cada linha vira um cartão (rótulos via data-rotulo). Desktop: tabela. */}
          <table className={estilos.tabela}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Progresso</th>
                <th>Próximo compromisso</th>
                <th>Prazo de liberação</th>
                <th>Atenção</th>
              </tr>
            </thead>
            <tbody>
              {onboardings.map((o) => (
                <tr key={o.id}>
                  <td className={estilos.cliente}>
                    <Link href={`/onboardings/${o.id}`}>{o.cliente}</Link>
                    <small>Criado em {formatarDataHora(o.criadoEm)}</small>
                  </td>
                  <td data-rotulo="Responsável">{o.responsavel}</td>
                  <td data-rotulo="Status">{rotuloStatusOnboarding(o.statusGeral)}</td>
                  <td data-rotulo="Progresso">
                    <ProgressoEtapas etapas={o.etapas} />
                  </td>
                  <td
                    data-rotulo="Próximo compromisso"
                    data-vazio={o.proximoCompromisso === null ? '' : undefined}
                  >
                    {o.proximoCompromisso ?? '—'}
                  </td>
                  <td
                    data-rotulo="Prazo de liberação"
                    data-vazio={o.prazoLiberacao === null ? '' : undefined}
                  >
                    {o.prazoLiberacao === null ? (
                      '—'
                    ) : (
                      <>
                        {formatarDataDoPrazo(o.prazoLiberacao)}
                        {o.indicadorPrazo && (
                          <span className={estilos.prazo} data-indicador={o.indicadorPrazo}>
                            {ROTULO_PRAZO[o.indicadorPrazo] ?? o.indicadorPrazo}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td data-rotulo="Atenção" data-vazio={o.atencao.length === 0 ? '' : undefined}>
                    {o.atencao.length === 0
                      ? '—'
                      : o.atencao.map((a) => (
                          <span key={a} className={estilos.alerta}>
                            {ROTULO_ATENCAO[a] ?? a}
                          </span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {limitado && <p className={estilos.vazio}>Mostrando os 200 mais recentes. Use os filtros.</p>}
    </>
  );
}
