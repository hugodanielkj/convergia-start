import Link from 'next/link';
import type { BloqueioVisao, ExcecaoVisao, FeriadoVisao, JanelaVisao } from './api';
import { BloquearDia } from './BloquearDia';
import { BotaoRemover } from './BotaoRemover';
import {
  adicionarDias,
  diaDaSemana,
  diaPorExtenso,
  diasDaSemana,
  enderecoDoCalendario,
  horarioDoDia,
  nomeDaSemana,
  nomeDoMes,
  numeroDoDia,
  rotuloMesCurto,
  semanasDoMes,
  somarMeses,
  primeiroDoMes,
  type HorarioDeTipo,
  type Tipo,
  type Visao,
} from './contas-calendario';
import { EditorDia } from './EditorDia';
import { formatarPeriodo, rotuloDia, rotuloTipo } from './mensagens';
import estilos from './agenda.module.css';

const TIPOS: readonly Tipo[] = ['reuniao', 'captacao'];

interface Props {
  readonly visao: Visao;
  readonly data: string;
  readonly dia: string | null;
  readonly hoje: string;
  readonly podeEditar: boolean;
  readonly janelas: readonly JanelaVisao[];
  readonly excecoes: readonly ExcecaoVisao[];
  readonly bloqueios: readonly BloqueioVisao[];
  readonly feriados: readonly FeriadoVisao[];
}

interface SituacaoDoDia {
  readonly horarios: readonly {
    readonly tipo: Tipo;
    readonly horarios: readonly HorarioDeTipo[];
    readonly personalizado: boolean;
  }[];
  readonly bloqueios: readonly BloqueioVisao[];
  readonly feriado: FeriadoVisao | undefined;
  readonly fechado: boolean;
}

const abreviacao = (dia: number): string => rotuloDia(dia).slice(0, 3);
const faixa = (h: { horaInicio: string; horaFim: string }): string =>
  `${h.horaInicio}–${h.horaFim}`;

export function Calendario(props: Props) {
  const { visao, data, dia, hoje } = props;
  const passo = visao === 'semana' ? 7 : 0;
  const anterior =
    visao === 'semana' ? adicionarDias(data, -passo) : somarMeses(primeiroDoMes(data), -1);
  const proximo =
    visao === 'semana' ? adicionarDias(data, passo) : somarMeses(primeiroDoMes(data), 1);
  const titulo = visao === 'semana' ? nomeDaSemana(data) : nomeDoMes(data);
  const rotuloPeriodo = visao === 'semana' ? 'semana' : 'mês';

  /** O que o calendário sabe de um dia: horários que valem, bloqueio e feriado. */
  function situacao(d: string): SituacaoDoDia {
    const horarios = TIPOS.map((tipo) => ({
      tipo,
      ...horarioDoDia(d, tipo, props.janelas, props.excecoes),
    }));
    const bloqueios = props.bloqueios.filter((b) => b.dataInicio <= d && d <= b.dataFim);
    const feriado = props.feriados.find((f) => f.data === d);
    const fechado = bloqueios.length > 0 || feriado !== undefined;
    return { horarios, bloqueios, feriado, fechado };
  }

  function rotuloAcessivel(d: string): string {
    const s = situacao(d);
    const partes = [
      `${diaPorExtenso(d)}${d === hoje ? ' (hoje)' : ''}`,
      ...(s.feriado ? [`feriado: ${s.feriado.nome}`] : []),
      ...(s.bloqueios.length > 0 ? ['sem atendimento (bloqueio)'] : []),
      ...(s.fechado
        ? []
        : s.horarios.map(
            (h) =>
              `${rotuloTipo(h.tipo)} ${h.horarios.length === 0 ? 'sem atendimento' : h.horarios.map(faixa).join(', ')}`,
          )),
      ...(s.horarios.some((h) => h.personalizado) ? ['horário alterado neste dia'] : []),
    ];
    return partes.join('; ');
  }

  const alvo = (d: string) => enderecoDoCalendario({ visao, data, dia: d });
  const classeDia = (d: string, extra = ''): string =>
    [
      estilos.diaCal,
      extra,
      d === dia ? estilos.diaSelecionado : '',
      d === hoje ? estilos.diaHoje : '',
    ]
      .filter(Boolean)
      .join(' ');

  function marcas(d: string) {
    const s = situacao(d);
    return (
      <>
        {s.feriado && <span className={estilos.selo}>Feriado</span>}
        {s.bloqueios.length > 0 && <span className={estilos.seloErro}>Bloqueado</span>}
        {!s.fechado && s.horarios.some((h) => h.personalizado) && (
          <span className={estilos.selo}>Alterado</span>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="titulo-calendario" className={estilos.secao}>
      <h2 id="titulo-calendario">Calendário</h2>

      <div className={estilos.barraCalendario}>
        <nav aria-label="Trocar de período" className={estilos.navegacao}>
          <Link
            href={enderecoDoCalendario({ visao, data: anterior })}
            className={estilos.botaoSecundario}
            aria-label={`${visao === 'semana' ? 'Semana' : 'Mês'} anterior`}
          >
            ‹
          </Link>
          <Link
            href={enderecoDoCalendario({ visao, data: hoje })}
            className={estilos.botaoSecundario}
          >
            Hoje
          </Link>
          <Link
            href={enderecoDoCalendario({ visao, data: proximo })}
            className={estilos.botaoSecundario}
            aria-label={`Próximo ${rotuloPeriodo}`}
          >
            ›
          </Link>
        </nav>
        <p className={estilos.periodo} aria-live="polite">
          {titulo}
        </p>
        <nav aria-label="Tipo de visão" className={estilos.navegacao}>
          {(['semana', 'mes'] as const).map((v) => (
            <Link
              key={v}
              href={enderecoDoCalendario({ visao: v, data, dia })}
              className={v === visao ? estilos.botao : estilos.botaoSecundario}
              aria-current={v === visao ? 'page' : undefined}
            >
              {v === 'semana' ? 'Semana' : 'Mês'}
            </Link>
          ))}
        </nav>
      </div>

      {visao === 'semana' ? (
        <ol className={estilos.semanaCal}>
          {diasDaSemana(data).map((d) => {
            const s = situacao(d);
            return (
              <li key={d}>
                <Link
                  href={alvo(d)}
                  className={classeDia(d)}
                  aria-label={rotuloAcessivel(d)}
                  scroll={false}
                >
                  <span className={estilos.cabecaDia}>
                    <strong>
                      {abreviacao(diaDaSemana(d))} {rotuloMesCurto(d)}
                    </strong>
                    {marcas(d)}
                  </span>
                  {s.feriado && <span className={estilos.suave}>{s.feriado.nome}</span>}
                  {s.fechado ? (
                    <span className={estilos.suave}>Sem atendimento</span>
                  ) : (
                    s.horarios.map((h) => (
                      <span key={h.tipo} className={estilos.linhaTipo}>
                        <span
                          className={
                            h.tipo === 'reuniao' ? estilos.pontoReuniao : estilos.pontoCaptacao
                          }
                          aria-hidden="true"
                        />
                        {rotuloTipo(h.tipo)}:{' '}
                        {h.horarios.length === 0 ? '—' : h.horarios.map(faixa).join(', ')}
                      </span>
                    ))
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={estilos.mesCal}>
          <ol className={estilos.titulosSemana} aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <li key={d}>{abreviacao(d)}</li>
            ))}
          </ol>
          <ol className={estilos.gradeMes}>
            {semanasDoMes(data)
              .flat()
              .map((d) => {
                const s = situacao(d);
                const doMes = d.slice(0, 7) === data.slice(0, 7);
                return (
                  <li key={d}>
                    <Link
                      href={alvo(d)}
                      className={classeDia(d, doMes ? '' : estilos.foraDoMes)}
                      aria-label={rotuloAcessivel(d)}
                      scroll={false}
                    >
                      <span className={estilos.numeroDia}>{numeroDoDia(d)}</span>
                      <span className={estilos.pontos} aria-hidden="true">
                        {s.fechado ? (
                          <span className={estilos.pontoFechado} />
                        ) : (
                          s.horarios
                            .filter((h) => h.horarios.length > 0)
                            .map((h) => (
                              <span
                                key={h.tipo}
                                className={
                                  h.tipo === 'reuniao'
                                    ? estilos.pontoReuniao
                                    : estilos.pontoCaptacao
                                }
                              />
                            ))
                        )}
                        {!s.fechado && s.horarios.some((h) => h.personalizado) && (
                          <span className={estilos.pontoAlterado} />
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ol>
        </div>
      )}

      <ul className={estilos.legenda}>
        <li>
          <span className={estilos.pontoReuniao} aria-hidden="true" /> Reunião
        </li>
        <li>
          <span className={estilos.pontoCaptacao} aria-hidden="true" /> Captação
        </li>
        <li>
          <span className={estilos.pontoAlterado} aria-hidden="true" /> Horário alterado no dia
        </li>
        <li>
          <span className={estilos.pontoFechado} aria-hidden="true" /> Sem atendimento
        </li>
      </ul>
      <p className={estilos.ajuda}>Toque num dia para ver ou mudar o horário só daquela data.</p>

      {dia !== null && <PainelDia {...props} dia={dia} situacao={situacao(dia)} />}
    </section>
  );
}

function PainelDia(props: Props & { dia: string; situacao: SituacaoDoDia }) {
  const { dia, hoje, podeEditar, situacao: s } = props;
  const passado = dia < hoje;
  const editavel = podeEditar && !passado && !s.fechado;

  return (
    <div className={estilos.painelDia} id="painel-dia">
      <div className={estilos.cabecaPainel}>
        <h3>
          {rotuloDia(diaDaSemana(dia))}, {diaPorExtenso(dia)}
        </h3>
        <Link
          href={enderecoDoCalendario({ visao: props.visao, data: props.data })}
          className={estilos.botaoSecundario}
          scroll={false}
        >
          Fechar
        </Link>
      </div>

      {passado && <p className={estilos.ajuda}>Este dia já passou: só dá para consultar.</p>}
      {s.feriado && (
        <p className={estilos.ajuda}>Feriado nacional ({s.feriado.nome}): não há atendimento.</p>
      )}
      {s.bloqueios.map((b) => (
        <div key={b.id} className={estilos.item}>
          <span>
            <strong>Bloqueado</strong> · {formatarPeriodo(b.dataInicio, b.dataFim)} · {b.motivo}
          </span>
          {podeEditar && (
            <BotaoRemover id={b.id} alvo="bloqueio" descricao={`bloqueio de ${b.motivo}`} />
          )}
        </div>
      ))}

      {!s.fechado &&
        s.horarios.map((h) => (
          <EditorDia
            key={`${dia}-${h.tipo}-${h.horarios.map(faixa).join()}-${String(h.personalizado)}`}
            tipo={h.tipo}
            rotulo={rotuloTipo(h.tipo)}
            data={dia}
            iniciais={h.horarios}
            personalizado={h.personalizado}
            somenteLeitura={!editavel}
          />
        ))}

      {podeEditar && !passado && !s.fechado && s.feriado === undefined && (
        <BloquearDia data={dia} />
      )}
      {!podeEditar && <p className={estilos.ajuda}>Só o Admin pode alterar.</p>}
    </div>
  );
}
