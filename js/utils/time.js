/**
 * Utilitários de conversão de tempo — todas as operações em minutos inteiros
 * para evitar inconsistências de ponto flutuante e fuso horário.
 */

/** Converte string HH:MM ou HH:MM:SS para minutos desde meia-noite */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
}

/** Converte minutos inteiros para string HH:MM */
export function minutesToHHMM(totalMinutes) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Formata saldo com prefixo Crédito/Débito */
export function formatSaldo(minutos) {
  if (minutos === 0) return '0:00';
  const label = minutos > 0 ? 'Crédito' : 'Débito';
  return `${label} ${minutesToHHMM(minutos)}`;
}

/** Retorna data ISO YYYY-MM-DD no fuso local */
export function toLocalDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Formata Date para exibição pt-BR */
export function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Formata hora TIME do Postgres (HH:MM:SS) para HH:MM */
export function formatTimeShort(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

/** Lista de datas entre início e fim (inclusive) */
export function eachDayInRange(startISO, endISO) {
  const days = [];
  const cur = new Date(startISO + 'T12:00:00');
  const end = new Date(endISO + 'T12:00:00');
  while (cur <= end) {
    days.push(toLocalDateISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Verifica se data está dentro de um intervalo */
export function isDateInRange(dateISO, startISO, endISO) {
  return dateISO >= startISO && dateISO <= endISO;
}

/** Dia da semana: 0=domingo ... 6=sábado */
export function getWeekday(dateISO) {
  return new Date(dateISO + 'T12:00:00').getDay();
}

/** É dia útil (seg-sex)? */
export function isWeekday(dateISO) {
  const wd = getWeekday(dateISO);
  return wd >= 1 && wd <= 5;
}

/** Primeiro e último dia do mês corrente */
export function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toLocalDateISO(start), end: toLocalDateISO(end) };
}

/** Início da semana (segunda) até hoje */
export function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return { start: toLocalDateISO(monday), end: toLocalDateISO(now) };
}
