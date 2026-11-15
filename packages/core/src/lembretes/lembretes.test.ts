import { describe, expect, it } from 'vitest';
import {
  dataNaMensagem,
  dentroDaJanela,
  horaNaMensagem,
  janelaDaConfig,
  lembreteCompromissoDevido,
  lembretePendenciaDevido,
  momentosLembreteCompromisso,
  proximoHorarioPermitido,
  textoPendencias,
  totalLembretesPendencia,
  ultimoHorarioPermitidoAte,
  validarJanelaEnvio,
  vencimentoPendencia,
  type JanelaEnvio,
} from './index.js';

// 2026-11-16 é segunda-feira. São Paulo = UTC-3.
const janela: JanelaEnvio = {
  inicio: '08:00',
  fim: '20:00',
  dias: [1, 2, 3, 4, 5, 6],
  fuso: 'America/Sao_Paulo',
};
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);

describe('RN-59 janela de envio', () => {
  it('aceita horários entre o início e o fim, inclusive, em dia permitido', () => {
    expect(dentroDaJanela(sp('2026-11-16T08:00'), janela)).toBe(true);
    expect(dentroDaJanela(sp('2026-11-16T20:00'), janela)).toBe(true);
    expect(dentroDaJanela(sp('2026-11-16T20:01'), janela)).toBe(false);
    expect(dentroDaJanela(sp('2026-11-16T07:59'), janela)).toBe(false);
  });

  it('recusa o domingo', () => {
    expect(dentroDaJanela(sp('2026-11-15T10:00'), janela)).toBe(false);
  });

  it('mensagem gerada às 23h sai no próximo horário permitido', () => {
    expect(proximoHorarioPermitido(sp('2026-11-16T23:00'), janela)).toEqual(sp('2026-11-17T08:00'));
  });

  it('dentro da janela, sai na hora', () => {
    const agora = sp('2026-11-16T10:30');
    expect(proximoHorarioPermitido(agora, janela)).toEqual(agora);
  });

  it('sábado à noite pula o domingo e sai na segunda', () => {
    expect(proximoHorarioPermitido(sp('2026-11-21T21:00'), janela)).toEqual(sp('2026-11-23T08:00'));
  });

  it('de madrugada sai às 08h do mesmo dia', () => {
    expect(proximoHorarioPermitido(sp('2026-11-17T03:00'), janela)).toEqual(sp('2026-11-17T08:00'));
  });

  it('antecipa para o fim da janela anterior', () => {
    expect(ultimoHorarioPermitidoAte(sp('2026-11-17T06:00'), janela)).toEqual(
      sp('2026-11-16T20:00'),
    );
    expect(ultimoHorarioPermitidoAte(sp('2026-11-23T06:00'), janela)).toEqual(
      sp('2026-11-21T20:00'),
    );
    expect(ultimoHorarioPermitidoAte(sp('2026-11-17T21:00'), janela)).toEqual(
      sp('2026-11-17T20:00'),
    );
  });

  it('sem dias permitidos não há horário', () => {
    expect(proximoHorarioPermitido(sp('2026-11-16T23:00'), { ...janela, dias: [] })).toBeNull();
    expect(ultimoHorarioPermitidoAte(sp('2026-11-16T23:00'), { ...janela, dias: [] })).toBeNull();
  });

  it('monta a janela a partir da configuração e formata data e hora no fuso', () => {
    expect(
      janelaDaConfig(
        { janelaEnvioInicio: '08:00', janelaEnvioFim: '20:00', diasEnvioPermitidos: [1] },
        'America/Sao_Paulo',
      ),
    ).toEqual({ inicio: '08:00', fim: '20:00', dias: [1], fuso: 'America/Sao_Paulo' });
    expect(dataNaMensagem(new Date('2026-11-17T02:00:00Z'), janela.fuso)).toBe('16/11/2026');
    expect(horaNaMensagem(new Date('2026-11-17T02:00:00Z'), janela.fuso)).toBe('23:00');
  });

  it('valida a janela da configuração', () => {
    expect(validarJanelaEnvio(janela)).toBeNull();
    expect(validarJanelaEnvio({ ...janela, inicio: '25:00' })).toBe('hora_invalida');
    expect(validarJanelaEnvio({ ...janela, fim: '08:00' })).toBe('fim_antes_do_inicio');
    expect(validarJanelaEnvio({ ...janela, dias: [] })).toBe('sem_dias');
    expect(validarJanelaEnvio({ ...janela, dias: [7] })).toBe('dia_invalido');
  });
});

describe('RN-56 lembretes de pendência', () => {
  const convite = sp('2026-11-16T10:00');
  const dias = [1, 3, 5];
  const entrada = (agora: Date, maximo = 3) => ({
    conviteEnviadoEm: convite,
    dias,
    maximo,
    agora,
  });

  it('vence em D+1, D+3 e D+5 depois do convite', () => {
    expect(vencimentoPendencia(convite, dias, 1)).toEqual(sp('2026-11-17T10:00'));
    expect(vencimentoPendencia(convite, dias, 3)).toEqual(sp('2026-11-21T10:00'));
    expect(vencimentoPendencia(convite, dias, 4)).toBeNull();
  });

  it('nenhum lembrete antes do D+1', () => {
    expect(lembretePendenciaDevido(entrada(sp('2026-11-17T09:59')))).toBeNull();
  });

  it('devolve o mais recente que venceu', () => {
    expect(lembretePendenciaDevido(entrada(sp('2026-11-17T10:00')))).toBe(1);
    expect(lembretePendenciaDevido(entrada(sp('2026-11-20T10:00')))).toBe(2);
    expect(lembretePendenciaDevido(entrada(sp('2026-12-30T10:00')))).toBe(3);
  });

  it('respeita o máximo configurado', () => {
    expect(lembretePendenciaDevido(entrada(sp('2026-12-30T10:00'), 2))).toBe(2);
    expect(lembretePendenciaDevido(entrada(sp('2026-12-30T10:00'), 0))).toBeNull();
    expect(totalLembretesPendencia(dias, 2)).toBe(2);
    expect(totalLembretesPendencia(dias, 5)).toBe(3);
  });

  it('aceita os dias fora de ordem', () => {
    expect(lembretePendenciaDevido({ ...entrada(sp('2026-11-17T10:00')), dias: [5, 1, 3] })).toBe(
      1,
    );
  });

  it('lista objetivamente o que falta, na ordem das etapas', () => {
    expect(textoPendencias(['captacao', 'formulario', 'acessos', 'reuniao'])).toBe(
      'preencher o formulário, liberar os acessos, agendar a reunião e agendar a captação',
    );
    expect(textoPendencias(['captacao', 'reuniao'])).toBe('agendar a reunião e agendar a captação');
    expect(textoPendencias(['acessos'])).toBe('liberar os acessos');
    expect(textoPendencias([])).toBe('');
  });
});

describe('RN-57 lembretes de compromisso', () => {
  const horas = [24, 2];

  it('24h e 2h antes, quando os dois caem na janela', () => {
    expect(momentosLembreteCompromisso(sp('2026-11-18T14:00'), horas, janela)).toEqual([
      { horas: 24, em: sp('2026-11-17T14:00') },
      { horas: 2, em: sp('2026-11-18T12:00') },
    ]);
  });

  it('o de 2h antes de uma reunião às 08h é antecipado para as 20h da véspera', () => {
    expect(momentosLembreteCompromisso(sp('2026-11-18T08:00'), horas, janela)).toEqual([
      { horas: 24, em: sp('2026-11-17T08:00') },
      { horas: 2, em: sp('2026-11-17T20:00') },
    ]);
  });

  it('se os dois coincidem depois de antecipar, sai um só', () => {
    // Segunda às 08h: 24h antes é domingo (vai para sábado 20h); 2h antes é 06h (também sábado 20h).
    expect(momentosLembreteCompromisso(sp('2026-11-23T08:00'), horas, janela)).toEqual([
      { horas: 24, em: sp('2026-11-21T20:00') },
    ]);
  });

  it('ignora horas repetidas e fora de ordem', () => {
    expect(momentosLembreteCompromisso(sp('2026-11-18T14:00'), [2, 24, 2], janela)).toHaveLength(2);
  });

  const devido = (agora: Date, marcadoEm = sp('2026-11-10T10:00')) =>
    lembreteCompromissoDevido({
      inicio: sp('2026-11-18T14:00'),
      marcadoEm,
      horas,
      janela,
      agora,
    });

  it('devolve o mais recente que venceu antes do compromisso', () => {
    expect(devido(sp('2026-11-17T13:59'))).toBeNull();
    expect(devido(sp('2026-11-17T14:00'))?.horas).toBe(24);
    expect(devido(sp('2026-11-18T12:30'))?.horas).toBe(2);
  });

  it('não envia depois que o compromisso começou', () => {
    expect(devido(sp('2026-11-18T14:00'))).toBeNull();
  });

  it('não envia o lembrete que venceria antes de o horário ser marcado', () => {
    expect(devido(sp('2026-11-17T20:00'), sp('2026-11-17T19:00'))).toBeNull();
    expect(devido(sp('2026-11-18T12:00'), sp('2026-11-17T19:00'))?.horas).toBe(2);
  });
});
