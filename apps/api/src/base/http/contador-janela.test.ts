import { describe, expect, it } from 'vitest';
import { ContadorEmMemoria } from './contador-janela.js';

describe('ContadorEmMemoria (RN-76)', () => {
  it('soma dentro da janela e recomeça quando ela vence', async () => {
    let agora = 0;
    const contador = new ContadorEmMemoria(() => agora);

    await contador.incrementar('a', 1000);
    expect(await contador.incrementar('a', 1000)).toEqual({ total: 2, reiniciaEm: 1000 });

    agora = 1000;
    expect(await contador.consultar('a')).toBeNull();
    expect(await contador.incrementar('a', 1000)).toEqual({ total: 1, reiniciaEm: 2000 });
  });

  it('não passa do teto de chaves: descarta vencidas e, se preciso, a mais antiga', async () => {
    let agora = 0;
    const contador = new ContadorEmMemoria(() => agora, 2);
    await contador.incrementar('vence', 10);
    await contador.incrementar('fica', 1000);

    agora = 20;
    await contador.incrementar('nova', 1000);
    expect(await contador.consultar('fica')).not.toBeNull();

    await contador.incrementar('mais-uma', 1000);
    expect(await contador.consultar('fica')).toBeNull();
    expect(await contador.consultar('nova')).not.toBeNull();
    expect(await contador.consultar('mais-uma')).not.toBeNull();
  });
});
