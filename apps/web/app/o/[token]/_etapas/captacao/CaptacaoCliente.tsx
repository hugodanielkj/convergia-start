'use client';

import { useState } from 'react';
import type { AgendamentoDoCliente } from '../reuniao/api';
import { formatarDiaEHora, fusoDoNavegador } from '../reuniao/formatar';
import reuniao from '../reuniao/reuniao.module.css';
import { SeletorHorario } from '../reuniao/SeletorHorario';
import estilos from './captacao.module.css';
import type { SituacaoCaptacao } from './api';

/** Dados do local (RN-40) e escolha do horário da captação, depois da reunião (RN-39). */
export function NovaCaptacao({ token }: { token: string }) {
  const [presencial, setPresencial] = useState(true);
  const [local, setLocal] = useState('');
  const [contato, setContato] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const faltaLocal = presencial && local.trim() === '';

  return (
    <div className={estilos.formulario}>
      <p>Conte onde será a captação e escolha o melhor dia.</p>
      <label className={estilos.opcao}>
        <input
          type="checkbox"
          checked={presencial}
          onChange={(e) => {
            setPresencial(e.target.checked);
          }}
        />
        A captação será presencial
      </label>
      <label className={estilos.campo}>
        Endereço ou local{presencial ? ' (obrigatório)' : ''}
        <input
          value={local}
          maxLength={300}
          onChange={(e) => {
            setLocal(e.target.value);
          }}
          aria-invalid={faltaLocal}
        />
      </label>
      <label className={estilos.campo}>
        Contato no local
        <input
          value={contato}
          maxLength={200}
          placeholder="Nome e telefone de quem nos recebe"
          onChange={(e) => {
            setContato(e.target.value);
          }}
        />
      </label>
      <label className={estilos.campo}>
        Observações
        <textarea
          value={observacoes}
          maxLength={1000}
          rows={3}
          placeholder="Produtos a filmar, restrições…"
          onChange={(e) => {
            setObservacoes(e.target.value);
          }}
        />
      </label>
      {faltaLocal && (
        <p className={reuniao.ajuda}>Informe o local para poder confirmar o horário.</p>
      )}
      <SeletorHorario
        token={token}
        modo={{ tipo: 'novo' }}
        tipo="captacao"
        confirmarBloqueado={faltaLocal}
        dadosCaptacao={{
          presencial,
          ...(local.trim() ? { local } : {}),
          ...(contato.trim() ? { contatoLocal: contato } : {}),
          ...(observacoes.trim() ? { observacoes } : {}),
        }}
      />
    </div>
  );
}

/** A captação marcada, com o local informado e a opção de reagendar enquanto puder (RN-35, RN-41). */
export function CaptacaoMarcada({
  token,
  agendamento,
  dados,
}: {
  token: string;
  agendamento: AgendamentoDoCliente;
  dados: NonNullable<SituacaoCaptacao['agendamento']>['dados'];
}) {
  const [reagendando, setReagendando] = useState(false);
  const [fuso] = useState(() => fusoDoNavegador());
  return (
    <div className={reuniao.agendado}>
      <p>
        Sua captação está marcada para{' '}
        <strong>
          <time dateTime={agendamento.inicio}>{formatarDiaEHora(agendamento.inicio, fuso)}</time>
        </strong>{' '}
        <span className={reuniao.ajuda}>({fuso.replaceAll('_', ' ')})</span>.
      </p>
      {dados && (
        <ul className={estilos.dados}>
          {dados.local && <li>Local: {dados.local}</li>}
          {dados.contatoLocal && <li>Contato no local: {dados.contatoLocal}</li>}
          {dados.observacoes && <li>Observações: {dados.observacoes}</li>}
        </ul>
      )}
      {!reagendando && agendamento.podeReagendar && (
        <div className={reuniao.acoes}>
          <button
            type="button"
            className={reuniao.botaoSecundario}
            onClick={() => {
              setReagendando(true);
            }}
          >
            Reagendar
          </button>
          <span className={reuniao.ajuda}>
            Você ainda pode reagendar {agendamento.reagendamentosRestantes} vez(es).
          </span>
        </div>
      )}
      {!agendamento.podeReagendar && (
        <p className={reuniao.ajuda}>
          Precisa remarcar? Os reagendamentos por aqui já acabaram ou o prazo passou. Entre em
          contato com a agência.
        </p>
      )}
      {reagendando && (
        <SeletorHorario
          token={token}
          tipo="captacao"
          modo={{ tipo: 'reagendar', agendamentoId: agendamento.id }}
          aoCancelar={() => {
            setReagendando(false);
          }}
          aoConcluir={() => {
            setReagendando(false);
          }}
        />
      )}
    </div>
  );
}
