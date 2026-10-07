// Sổ chi tiêu tháng: API trên Cloudflare Workers + D1.
// Mọi đường dẫn /api/* cần header "Authorization: Bearer <APP_PASSWORD>".
// Các đường dẫn khác trả về giao diện trong thư mục public/.

const CATS = new Set([
  // Chi tiêu thiết yếu
  'nha','diennuoc','guixe','thucpham','dilai','dodung','cattoc','suckhoe','hoctap','giadinh','tragop',
  // Chi tiêu mong muốn
  'anngoai','uongngoai','muado','thethao','giaitri','hieuhy','phatsinh',
  // Tiết kiệm
  'vang','tien','tk_khac',
  // Mã cũ, vẫn nhận để dữ liệu cũ không bị lỗi
  'an','hoadon','muasam','quatang','khac',
]);
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_MONEY = 1e12;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const bad = (msg) => json({ error: msg }, 400);
const money = (v) => Number.isInteger(v) && v >= 0 && v < MAX_MONEY;

function safeEqual(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

async function readJson(req) {
  try { return await req.json(); } catch { return null; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    if (!env.APP_PASSWORD) return json({ error: 'Chưa đặt APP_PASSWORD trên máy chủ' }, 500);
    const auth = req.headers.get('authorization') || '';
    const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!given || !safeEqual(given, env.APP_PASSWORD)) return json({ error: 'Sai mật khẩu' }, 401);

    const parts = url.pathname.split('/').filter(Boolean).slice(1); // bỏ 'api'
    const [res, key] = [parts[0], parts[1] ? decodeURIComponent(parts[1]) : undefined];
    const m = req.method;
    const DB = env.DB;

    try {
      // GET /api/all: toàn bộ dữ liệu
      if (res === 'all' && m === 'GET') {
        const [months, budgets, txs, goals] = await DB.batch([
          DB.prepare('SELECT ym, income, save_pct FROM months'),
          DB.prepare('SELECT ym, cat, amount FROM budgets'),
          DB.prepare('SELECT id, d, ym, amt, cat, note FROM transactions ORDER BY d, created_at'),
          DB.prepare('SELECT id, name, target, saved, deadline FROM goals ORDER BY rowid'),
        ]);
        const out = {};
        const ensure = (ym) => (out[ym] ||= { income: 0, savePct: 0.2, budgets: {}, tx: [] });
        for (const r of months.results) { const o = ensure(r.ym); o.income = r.income; o.savePct = r.save_pct; }
        for (const r of budgets.results) ensure(r.ym).budgets[r.cat] = r.amount;
        for (const r of txs.results) ensure(r.ym).tx.push({ id: r.id, d: r.d, amt: r.amt, cat: r.cat, note: r.note });
        return json({ months: out, goals: goals.results });
      }

      // PUT /api/months/:ym  {income, savePct, budgets:{cat:amount}}
      if (res === 'months' && m === 'PUT') {
        if (!YM.test(key || '')) return bad('Tháng không hợp lệ');
        const b = await readJson(req);
        if (!b || !money(b.income)) return bad('Thu nhập không hợp lệ');
        const sp = Number(b.savePct);
        if (!(sp >= 0 && sp <= 0.9)) return bad('Tỷ lệ tiết kiệm không hợp lệ');
        const stmts = [
          DB.prepare('INSERT INTO months (ym, income, save_pct) VALUES (?1, ?2, ?3) ON CONFLICT(ym) DO UPDATE SET income = excluded.income, save_pct = excluded.save_pct').bind(key, b.income, sp),
          DB.prepare('DELETE FROM budgets WHERE ym = ?1').bind(key),
        ];
        for (const [cat, amount] of Object.entries(b.budgets || {})) {
          if (!CATS.has(cat) || !money(amount)) return bad('Hạn mức không hợp lệ: ' + cat);
          stmts.push(DB.prepare('INSERT INTO budgets (ym, cat, amount) VALUES (?1, ?2, ?3)').bind(key, cat, amount));
        }
        await DB.batch(stmts);
        return new Response(null, { status: 204 });
      }

      // POST /api/tx  {id, d, amt, cat, note}
      if (res === 'tx' && m === 'POST') {
        const t = await readJson(req);
        if (!t || !ID.test(t.id || '')) return bad('Mã giao dịch không hợp lệ');
        if (!DATE.test(t.d || '')) return bad('Ngày không hợp lệ');
        if (!money(t.amt) || t.amt === 0) return bad('Số tiền không hợp lệ');
        if (!CATS.has(t.cat)) return bad('Danh mục không hợp lệ');
        const note = String(t.note || '').slice(0, 200);
        await DB.prepare('INSERT OR REPLACE INTO transactions (id, d, ym, amt, cat, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
          .bind(t.id, t.d, t.d.slice(0, 7), t.amt, t.cat, note).run();
        return new Response(null, { status: 204 });
      }

      // DELETE /api/tx/:id
      if (res === 'tx' && m === 'DELETE') {
        if (!ID.test(key || '')) return bad('Mã giao dịch không hợp lệ');
        await DB.prepare('DELETE FROM transactions WHERE id = ?1').bind(key).run();
        return new Response(null, { status: 204 });
      }

      // PUT /api/goals/:id  {name, target, saved, deadline}
      if (res === 'goals' && m === 'PUT') {
        const g = await readJson(req);
        if (!ID.test(key || '') || !g) return bad('Mục tiêu không hợp lệ');
        const name = String(g.name || '').trim().slice(0, 100);
        if (!name || !money(g.target) || g.target === 0 || !money(g.saved)) return bad('Mục tiêu không hợp lệ');
        const deadline = YM.test(g.deadline || '') ? g.deadline : '';
        await DB.prepare('INSERT INTO goals (id, name, target, saved, deadline) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET name = excluded.name, target = excluded.target, saved = excluded.saved, deadline = excluded.deadline')
          .bind(key, name, g.target, g.saved, deadline).run();
        return new Response(null, { status: 204 });
      }

      // DELETE /api/goals/:id
      if (res === 'goals' && m === 'DELETE') {
        if (!ID.test(key || '')) return bad('Mục tiêu không hợp lệ');
        await DB.prepare('DELETE FROM goals WHERE id = ?1').bind(key).run();
        return new Response(null, { status: 204 });
      }

      return json({ error: 'Không tìm thấy' }, 404);
    } catch (e) {
      return json({ error: 'Lỗi máy chủ', detail: String(e && e.message || e) }, 500);
    }
  },
};
