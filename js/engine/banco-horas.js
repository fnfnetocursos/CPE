/**
 * Motor de cálculo do Banco de Horas
 * Converte tudo para minutos inteiros antes de calcular.
 */
import {
  timeToMinutes,
  minutesToHHMM,
  formatSaldo,
  eachDayInRange,
  isDateInRange,
  isWeekday
} from './time.js';

const TIPO_LABELS = {
  ENTRADA: 'Entrada',
  SAIDA_ALMOCO: 'Saída Almoço',
  RETORNO_ALMOCO: 'Retorno Almoço',
  SAIDA: 'Saída',
  HORAS_EXTRA: 'Horas Extra'
};

/** Agrupa registros por data */
export function groupRegistrosByDate(registros) {
  const map = {};
  registros.forEach((r) => {
    const d = r.data_registro;
    if (!map[d]) map[d] = [];
    map[d].push(r);
  });
  Object.values(map).forEach((arr) =>
    arr.sort((a, b) => timeToMinutes(a.hora_registro) - timeToMinutes(b.hora_registro))
  );
  return map;
}

/** Calcula minutos trabalhados em um dia a partir das batidas */
export function calcMinutosTrabalhadosDia(registrosDia) {
  if (!registrosDia?.length) return 0;

  let total = 0;
  let entrada = null;
  let retornoAlmoco = null;

  registrosDia.forEach((r) => {
    const min = timeToMinutes(r.hora_registro);
    switch (r.tipo_registro) {
      case 'ENTRADA':
        entrada = min;
        break;
      case 'SAIDA_ALMOCO':
        if (entrada !== null) total += min - entrada;
        entrada = null;
        break;
      case 'RETORNO_ALMOCO':
        retornoAlmoco = min;
        entrada = min;
        break;
      case 'SAIDA':
      case 'HORAS_EXTRA':
        if (entrada !== null) total += min - entrada;
        entrada = null;
        break;
      default:
        break;
    }
  });

  return Math.max(0, total);
}

/** Formata marcações do dia para exibição */
export function formatMarcacoesDia(registrosDia) {
  if (!registrosDia?.length) return '—';
  return registrosDia
    .map((r) => `${TIPO_LABELS[r.tipo_registro] || r.tipo_registro} ${r.hora_registro.substring(0, 5)}`)
    .join(' · ');
}

/** Verifica se data é feriado */
export function isFeriado(dateISO, feriados, empresaId) {
  return feriados.some(
    (f) =>
      f.data_feriado === dateISO &&
      (f.empresa_id === null || f.empresa_id === empresaId)
  );
}

/** Verifica afastamento abonado na data */
export function isAfastamentoAbonado(dateISO, afastamentos, userId) {
  return afastamentos.some(
    (a) =>
      a.user_id === userId &&
      a.abonado &&
      isDateInRange(dateISO, a.data_inicio, a.data_fim)
  );
}

/** Dia deve contar carga prevista? */
export function diaContaCarga(dateISO, feriados, afastamentos, userId, empresaId) {
  if (!isWeekday(dateISO)) return false;
  if (isFeriado(dateISO, feriados, empresaId)) return false;
  if (isAfastamentoAbonado(dateISO, afastamentos, userId)) return false;
  return true;
}

/**
 * Calcula espelho de ponto e consolidado do período
 */
export function calcularBancoHoras({
  registros,
  jornada,
  feriados,
  afastamentos,
  userId,
  empresaId,
  dataInicio,
  dataFim
}) {
  const cargaPrevista = jornada?.carga_diaria_minutos ?? 480;
  const entradaPrevista = jornada ? timeToMinutes(jornada.entrada_prevista) : 480;
  const saidaPrevista = jornada ? timeToMinutes(jornada.saida_prevista) : 1080;
  const tolerancia = jornada?.tolerancia_minutos ?? 10;

  const byDate = groupRegistrosByDate(registros);
  const dias = eachDayInRange(dataInicio, dataFim);

  let totalTrabalhado = 0;
  let totalFaltante = 0;
  let saldoAcumulado = 0;
  let diasAtraso = 0;
  let diasHoraExtra = 0;

  const espelho = dias.map((data) => {
    const regs = byDate[data] || [];
    const minutosTrabalhados = calcMinutosTrabalhadosDia(regs);
    const contaCarga = diaContaCarga(data, feriados, afastamentos, userId, empresaId);

    let cargaDia = contaCarga ? cargaPrevista : 0;
    let saldoDia = minutosTrabalhados - cargaDia;

    if (contaCarga && minutosTrabalhados === 0 && regs.length === 0) {
      saldoDia = -cargaPrevista;
    }

    if (contaCarga) {
      totalTrabalhado += minutosTrabalhados;
      if (saldoDia < 0) totalFaltante += Math.abs(saldoDia);
      saldoAcumulado += saldoDia;

      const entrada = regs.find((r) => r.tipo_registro === 'ENTRADA');
      if (entrada) {
        const minEntrada = timeToMinutes(entrada.hora_registro);
        if (minEntrada > entradaPrevista + tolerancia) diasAtraso++;
      } else if (regs.length === 0) {
        /* falta total — já contabilizada no saldo */
      }

      const saida = [...regs].reverse().find((r) => r.tipo_registro === 'SAIDA' || r.tipo_registro === 'HORAS_EXTRA');
      if (saida) {
        const minSaida = timeToMinutes(saida.hora_registro);
        if (minSaida > saidaPrevista) diasHoraExtra++;
      }
    } else {
      saldoDia = minutosTrabalhados;
      totalTrabalhado += minutosTrabalhados;
      saldoAcumulado += saldoDia;
    }

    return {
      data,
      marcacoes: formatMarcacoesDia(regs),
      cargaPrevista: contaCarga ? minutesToHHMM(cargaPrevista) : '—',
      horasTrabalhadas: minutesToHHMM(minutosTrabalhados),
      saldoDia,
      saldoFormatado: formatSaldo(saldoDia),
      minutosTrabalhados,
      contaCarga
    };
  });

  return {
    espelho,
    totalHorasTrabalhadas: minutesToHHMM(totalTrabalhado),
    totalHorasFaltantes: minutesToHHMM(totalFaltante),
    diasAtraso,
    diasHoraExtra,
    saldoBancoHoras: formatSaldo(saldoAcumulado),
    saldoMinutos: saldoAcumulado
  };
}

/** Próximo tipo de batida sugerido */
export function proximoTipoBatida(registrosHoje) {
  if (!registrosHoje.length) return 'ENTRADA';
  const ultimo = [...registrosHoje].sort(
    (a, b) => timeToMinutes(b.hora_registro) - timeToMinutes(a.hora_registro)
  )[0];
  const map = {
    ENTRADA: 'SAIDA_ALMOCO',
    SAIDA_ALMOCO: 'RETORNO_ALMOCO',
    RETORNO_ALMOCO: 'SAIDA',
    SAIDA: 'HORAS_EXTRA',
    HORAS_EXTRA: null
  };
  return map[ultimo.tipo_registro] ?? 'ENTRADA';
}

export { TIPO_LABELS };
