'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  criarApiReuniao,
  type DadosCaptacaoEnviados,
  type ListaDeHorarios,
  type TipoAtendimento,
} from './api';
import {
  formatarDia,
  fusoDoNavegador,
  fusosDisponiveis,
  partesDoDia,
  periodoDaHora,
  type Periodo,
} from './formatar';
import estilos from './reuniao.module.css';
import { useAvancoEtapa } from '../../_componentes/avanco';

export type ModoSeletor =
  { readonly tipo: 'novo' } | { readonly tipo: 'reagendar'; readonly agendamentoId: string };

/** Dias à mostra antes de "Ver mais dias": duas linhas de botões no celular. */
const DIAS_VISIVEIS = 8;

interface Mensagem {
  readonly tipo: 'erro' | 'aviso';
  readonly texto: string;
}

interface Props {
  readonly token: string;
  readonly modo: ModoSeletor;
  /** Reunião (padrão) ou captação, que leva os dados do local (RN-40). */
  readonly tipo?: TipoAtendimento;
  readonly dadosCaptacao?: DadosCaptacaoEnviados;
  /** Impede confirmar enquanto os dados do local estão incompletos. */
  readonly confirmarBloqueado?: boolean;
  /** Chamado ao fechar sem escolher, só no modo reagendar. */
  readonly aoCancelar?: () => void;
  /** Chamado quando o horário foi confirmado, antes de a página recarregar. */
  readonly aoConcluir?: () => void;
}

/**
 * Escolha do horário da reunião (RN-30 a RN-33, RN-35). Os horários aparecem no fuso do
 * navegador, que o cliente pode trocar (RN-32). Se alguém reservar o horário antes, a lista
 * é substituída pela atualizada que a API devolve junto com o aviso.
 */
export function SeletorHorario({
  token,
  modo,
  tipo = 'reuniao',
  dadosCaptacao,
  confirmarBloqueado = false,
  aoCancelar,
  aoConcluir,
}: Props) {
  const roteador = useRouter();
  const { avancar } = useAvancoEtapa();
  const api = useMemo(
    () => criarApiReuniao({ baseUrl: '/api', fetcher: (...args) => fetch(...args) }),
    [],
  );
  const [fuso, setFuso] = useState<string | null>(null);
  const [lista, setLista] = useState<ListaDeHorarios | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [todosOsDias, setTodosOsDias] = useState(false);

  const irParaLinkExpirado = () => {
    window.location.assign(`/o/${encodeURIComponent(token)}/expirado`);
  };

  useEffect(() => {
    setFuso(fusoDoNavegador());
  }, []);

  useEffect(() => {
    if (fuso === null) return;
    let cancelado = false;
    setCarregando(true);
    setEscolhido(null);
    void api.listarHorarios(token, fuso, tipo).then((resultado) => {
      if (cancelado) return;
      setCarregando(false);
      if (resultado.tipo === 'ok') {
        setLista(resultado.lista);
        setMensagem(null);
      } else if (resultado.tipo === 'expirado') {
        irParaLinkExpirado();
      } else {
        setMensagem({
          tipo: 'erro',
          texto: resultado.tipo === 'falha' ? resultado.mensagem : 'Este link não é mais válido.',
        });
      }
    });
    return () => {
      cancelado = true;
    };
    // `irParaLinkExpirado` só usa o token, que já está na lista de dependências.
  }, [api, token, fuso, tipo]);

  async function confirmar() {
    if (escolhido === null || fuso === null) return;
    setEnviando(true);
    setMensagem(null);
    const resultado =
      modo.tipo === 'novo'
        ? await api.reservar(token, escolhido, fuso, tipo, dadosCaptacao)
        : await api.reagendar(token, modo.agendamentoId, escolhido, fuso);
    setEnviando(false);

    switch (resultado.tipo) {
      case 'ok':
      case 'ja_agendado':
        aoConcluir?.();
        // RN-79 (contrato da casca, trilha A): agendou → segue para a próxima etapa.
        if (modo.tipo === 'novo') avancar();
        else roteador.refresh();
        return;
      case 'indisponivel':
        setLista(resultado.lista);
        setEscolhido(null);
        setMensagem({
          tipo: 'aviso',
          texto: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.',
        });
        return;
      case 'negado':
        setMensagem({ tipo: 'erro', texto: resultado.mensagem });
        return;
      case 'expirado':
        irParaLinkExpirado();
        return;
      case 'invalido':
        setMensagem({ tipo: 'erro', texto: 'Este link não é mais válido.' });
        return;
      case 'falha':
        setMensagem({ tipo: 'erro', texto: resultado.mensagem });
    }
  }

  const rotuloBotao = modo.tipo === 'novo' ? 'Confirmar horário' : 'Confirmar novo horário';
  const dias = lista?.dias ?? [];
  // Abre no primeiro dia com vaga (padrão de agendas como o Calendly) ou no que o cliente tocou.
  const dia = dias.find((d) => d.data === diaAberto) ?? dias[0];
  const visiveis =
    todosOsDias || dias.length <= DIAS_VISIVEIS ? dias : dias.slice(0, DIAS_VISIVEIS);
  // Se o dia aberto ficou escondido (lista atualizada), ele continua à mostra.
  const diasNaFaixa = dia && !visiveis.includes(dia) ? [...visiveis, dia] : visiveis;
  const periodos = new Map<Periodo, NonNullable<typeof dia>['slots']>();
  for (const slot of dia?.slots ?? []) {
    const periodo = periodoDaHora(slot.hora);
    periodos.set(periodo, [...(periodos.get(periodo) ?? []), slot]);
  }
  const selecionado = dias
    .flatMap((d) => d.slots.map((slot) => ({ data: d.data, slot })))
    .find((x) => x.slot.inicio === escolhido);

  return (
    <div className={estilos.seletor}>
      <div aria-live="polite">
        {mensagem && (
          <p
            role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
            className={mensagem.tipo === 'erro' ? estilos.erro : estilos.aviso}
          >
            {mensagem.texto}
          </p>
        )}
      </div>

      {carregando && <p className={estilos.ajuda}>Buscando horários…</p>}

      {!carregando && lista !== null && lista.dias.length === 0 && (
        <p className={estilos.vazio}>
          Não há horários livres nas próximas semanas. Entre em contato com a agência.
        </p>
      )}

      {!carregando && dia && (
        <>
          <div role="group" aria-label="Dias com horário livre" className={estilos.faixa}>
            {diasNaFaixa.map((d) => {
              const p = partesDoDia(d.data);
              const quantos = `${String(d.slots.length)} ${d.slots.length === 1 ? 'horário' : 'horários'}`;
              return (
                <button
                  key={d.data}
                  type="button"
                  className={estilos.diaBotao}
                  aria-pressed={d.data === dia.data}
                  aria-label={`${formatarDia(d.data)}, ${quantos}`}
                  onClick={() => {
                    setDiaAberto(d.data);
                  }}
                >
                  <span className={estilos.semana}>{p.semana}</span>
                  <span className={estilos.numero}>{p.dia}</span>
                  <span className={estilos.mes}>{p.mes}</span>
                </button>
              );
            })}
          </div>
          {dias.length > diasNaFaixa.length && (
            <button
              type="button"
              className={estilos.maisDias}
              onClick={() => {
                setTodosOsDias(true);
              }}
            >
              Ver mais dias
            </button>
          )}

          <fieldset className={estilos.dia}>
            <legend>{formatarDia(dia.data)}</legend>
            {[...periodos].map(([periodo, slots]) => (
              <div key={periodo} className={estilos.periodo}>
                <p className={estilos.nomePeriodo}>{periodo}</p>
                <div className={estilos.horarios}>
                  {slots.map((slot) => (
                    <button
                      key={slot.inicio}
                      type="button"
                      className={estilos.horario}
                      aria-pressed={escolhido === slot.inicio}
                      onClick={() => {
                        setEscolhido(slot.inicio);
                      }}
                    >
                      {slot.hora}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
        </>
      )}

      {fuso !== null && (
        <details className={estilos.fuso}>
          <summary>
            Horários no fuso <strong>{fuso.replaceAll('_', ' ')}</strong>
            <span className={estilos.trocar}>Trocar</span>
          </summary>
          <label htmlFor="fuso-cliente">Trocar o fuso</label>
          <select
            id="fuso-cliente"
            value={fuso}
            onChange={(evento) => {
              setFuso(evento.target.value);
            }}
          >
            {fusosDisponiveis(fuso).map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </details>
      )}

      <div className={estilos.acoes}>
        {selecionado && (
          <p className={estilos.selecionado} aria-live="polite">
            {formatarDia(selecionado.data)}, às <strong>{selecionado.slot.hora}</strong>
          </p>
        )}
        <button
          type="button"
          className={estilos.botao}
          disabled={escolhido === null || enviando || confirmarBloqueado}
          onClick={() => void confirmar()}
        >
          {enviando ? 'Confirmando…' : rotuloBotao}
        </button>
        {aoCancelar && (
          <button type="button" className={estilos.botaoSecundario} onClick={aoCancelar}>
            Manter o horário atual
          </button>
        )}
      </div>
    </div>
  );
}
