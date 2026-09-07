/**
 * 紙に添える時刻。
 *
 * 今日の紙は時刻だけ、前の日の紙は日付も添える。
 * 「3分前」のような相対表記は使わない（更新頻度を意識させて急かすため）。
 *
 * 判定も書式も JST で固定する。読み手の端末で組み立てるとサーバと食い違って
 * 描き直しが起きるので、必ずサーバ側でこの関数を通してから渡すこと。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 保存日時は変えず、表示と期間指定だけをJSTに揃える。 */
export function jstDate(at: Date): string {
  const p = jstParts(at);
  return `${p.day.slice(0, 4)}年${p.month}月${p.date}日`;
}

export function jstDateLine(at: Date): string {
  const d = new Date(at.getTime() + JST_OFFSET_MS);
  return `${jstDate(at)}　${["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()]}曜`;
}

export function jstMonth(at: Date): string {
  return jstParts(at).day.slice(0, 7);
}

/** 月末を含め、次月の午前0時を含まない半開区間。 */
export function jstMonthRange(month: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const year = Number(month.slice(0, 4));
  if (year < 1000 || year > 9998) return null;
  const m = Number(month.slice(5));
  return {
    start: new Date(Date.UTC(year, m - 1, 1) - JST_OFFSET_MS),
    end: new Date(Date.UTC(year, m, 1) - JST_OFFSET_MS),
  };
}

function jstParts(at: Date) {
  const d = new Date(at.getTime() + JST_OFFSET_MS);
  return {
    day: d.toISOString().slice(0, 10),
    month: d.getUTCMonth() + 1,
    date: d.getUTCDate(),
    hh: `${d.getUTCHours()}`.padStart(2, "0"),
    mm: `${d.getUTCMinutes()}`.padStart(2, "0"),
  };
}

export function jstStamp(at: Date, now: Date = new Date()): string {
  const t = jstParts(at);
  const today = jstParts(now).day;
  const time = `${t.hh}:${t.mm}`;
  return t.day === today ? time : `${t.month}月${t.date}日　${time}`;
}
