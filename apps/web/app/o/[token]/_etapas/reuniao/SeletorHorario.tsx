'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  criarApiReuniao,
  type DadosCaptacaoEnviados,
  type ListaDeHorarios,
  type TipoAtendimento,
} from './api';
import { formatarDia, fusoDoNavegador, fusosDisponiveis } from './formatar';
import estilos from './reuniao.module.css';

export type ModoSeletor =
  { readonly tipo: 'novo' } | { readonly tipo: 'reagendar'; readonly agendamentoId: string };

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
        roteador.refresh();
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

  return (
    <div className={estilos.seletor}>
      {fuso !== null && (
        <div className={estilos.fuso}>
          <label htmlFor="fuso-cliente">Horários no fuso</label>
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
        </div>
      )}

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
        <p>Não há horários livres nas próximas semanas. Entre em contato com a agência.</p>
      )}

      {!carregando &&
        lista?.dias.map((dia) => (
          <fieldset key={dia.data} className={estilos.dia}>
            <legend>{formatarDia(dia.data)}</legend>
            <div className={estilos.horarios}>
              {dia.slots.map((slot) => (
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
          </fieldset>
        ))}

      <div className={estilos.acoes}>
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
