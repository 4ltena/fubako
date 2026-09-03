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
