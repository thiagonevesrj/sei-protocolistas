(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('acao') !== 'procedimento_trabalhar') return;
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const escapeHtml = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const processPattern = /SEI-\d{6}\/\d{5,9}\/\d{4}/i;
  function documents() {
    const found = [], visited = new Set();
    function visit(win) {
      if (!win || visited.has(win)) return;
      visited.add(win);
      try { found.push(win.document); for (let i = 0; i < win.frames.length; i++) visit(win.frames[i]); } catch (error) { /* frame indisponível */ }
    }
    visit(window.top);
    return found;
  }
  function historyTable(doc) {
    return [...doc.querySelectorAll('table')].find(table => {
      const header = norm(table.rows?.[0]?.innerText || table.rows?.[0]?.textContent || '').toLowerCase();
      return header.includes('data/hora') && header.includes('unidade') && header.includes('usuario') && header.includes('descricao');
    }) || null;
  }
  function readHistory(table) {
    const headers = [...(table.rows[0]?.cells || [])].map(cell => norm(cell.innerText || cell.textContent).toLowerCase());
    const dateIndex = headers.findIndex(value => value.includes('data/hora'));
    const unitIndex = headers.findIndex(value => value === 'unidade');
    const descIndex = headers.findIndex(value => value.includes('descricao'));
    return [...table.rows].slice(1).map(row => {
      const cells = [...row.cells];
      return { date: norm(cells[dateIndex]?.innerText || cells[dateIndex]?.textContent), unit: norm(cells[unitIndex]?.innerText || cells[unitIndex]?.textContent), description: norm(cells[descIndex]?.innerText || cells[descIndex]?.textContent) };
    }).filter(item => item.date && item.unit && item.description);
  }
  function dateValue(value) {
    const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    return match ? new Date(+match[3], +match[2] - 1, +match[1], +(match[4] || 0), +(match[5] || 0)).getTime() : 0;
  }
  function printPage(data) {
    const status = data.completed ? 'Seu processo foi concluído na unidade' : 'Seu processo encontra-se na unidade';
    const newest = data.latest;
    const events = data.events.map(event => `<tr><td>${escapeHtml(event.date)}</td><td>${escapeHtml(event.unit)}</td><td>${escapeHtml(event.description)}</td></tr>`).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Acompanhamento ${escapeHtml(data.number)}</title><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#14263b;font:14px Arial,sans-serif}.toolbar{position:sticky;top:0;padding:12px;text-align:center;background:#0b2545}.toolbar button{padding:10px 20px;border:2px solid #d6a326;border-radius:6px;background:#fff;color:#0b2545;font-weight:800;cursor:pointer}.page{max-width:900px;margin:24px auto;padding:28px;background:#fff}.brand{padding:22px 26px;border-left:8px solid #d6a326;border-radius:8px;background:#0b2545;color:#fff}.brand h1{margin:0 0 7px;font-size:22px}.brand p{margin:0;color:#e3eaf2}.status{margin:20px 0;padding:22px;border:1px solid #c7d4e2;border-radius:8px;background:#f3f7fb}.status strong{display:block;margin:10px 0;color:#174a7e;font-size:21px}.number{margin:5px 0 12px;color:#0b2545;font-size:30px;font-weight:900;letter-spacing:.4px}.info{display:grid;grid-template-columns:1fr 1fr;gap:14px}.box{padding:15px;border:1px solid #c7d4e2;border-radius:7px}.label{display:block;margin-bottom:7px;color:#526273;font-size:11px;font-weight:800;text-transform:uppercase}.value{font-weight:700}.history{margin-top:20px}h2{font-size:16px;color:#174a7e}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #c7d4e2;text-align:left;vertical-align:top}th{background:#eaf1f8;color:#174a7e;font-size:12px}.footer{margin-top:18px;color:#526273;font-size:11px;line-height:1.5}@media print{.toolbar{display:none}.page{margin:0;padding:0;max-width:none}tr{break-inside:avoid}}
      </style></head><body><div class="toolbar"><button onclick="window.print()">🖨 IMPRIMIR</button> <button onclick="window.close()">FECHAR</button></div><main class="page"><header class="brand"><h1>ACOMPANHAMENTO DO PROCESSO</h1><p>DETRAN-RJ · Sistema Eletrônico de Informações</p></header><section class="status"><span class="label">NÚMERO DO PROCESSO</span><div class="number">${escapeHtml(data.number)}</div><strong>${status} ${escapeHtml(newest.unit)}.</strong><div class="info"><div class="box"><span class="label">Última movimentação</span><span class="value">${escapeHtml(newest.description)}</span></div><div class="box"><span class="label">Data e hora</span><span class="value">${escapeHtml(newest.date)}</span></div></div></section><section class="history"><h2>Movimentações do processo (${data.events.length})</h2><table><thead><tr><th>Data e hora</th><th>Unidade</th><th>Movimentação</th></tr></thead><tbody>${events}</tbody></table></section><section class="history"><h2>Como consultar o processo</h2><ol><li>Acesse <strong>portalsei.rj.gov.br/pesquisaprocessualmunicipios</strong>.</li><li>Informe o número completo do processo acima.</li><li>Em “Municípios”, selecione “ERJ”.</li><li>Preencha o código de verificação exibido na tela.</li><li>Clique em “Pesquisar processos” e depois no número do processo.</li></ol></section><p class="footer">Este comprovante reflete as movimentações exibidas pelo SEI na data da impressão. Consulte novamente o portal para ver atualizações posteriores.</p></main></body></html>`;
  }
  function mount() {
    for (const doc of documents()) {
      if (doc.getElementById('sp-acompanhamento-print')) continue;
      const heading = [...doc.querySelectorAll('h1,h2,h3,[role="heading"],strong,b,span,div')].find(item => {
        const text = norm(item.innerText || item.textContent);
        return !item.children.length && /^Historico do Processo\b/i.test(text);
      });
      if (!heading) continue;
      const processMatch = `${heading.innerText || heading.textContent} ${doc.body?.innerText || doc.body?.textContent || ''}`.match(processPattern);
      if (!processMatch) continue;
      const button = doc.createElement('button');
      button.id = 'sp-acompanhamento-print';
      button.type = 'button';
      button.textContent = 'Imprimir andamento do processo';
      button.setAttribute('aria-label', 'Imprimir andamento do processo');
      button.style.cssText = 'margin:12px 0;padding:11px 16px;border:2px solid #d6a326;border-radius:6px;background:#0b2545;color:#fff;font-weight:800;cursor:pointer';
      button.addEventListener('click', () => {
        const table = historyTable(doc);
        if (!table) { window.alert('Não localizei a tabela de movimentações do SEI nesta tela.'); return; }
        const currentEvents = readHistory(table).sort((a, b) => dateValue(b.date) - dateValue(a.date));
        if (!currentEvents.length) { window.alert('O SEI não carregou as movimentações. Atualize o andamento e tente novamente.'); return; }
        const popup = window.open('', '_blank');
        if (!popup) { window.alert('Autorize pop-ups para imprimir o andamento.'); return; }
        const latest = currentEvents[0];
        const isComplete = /conclus[aã]o do processo|processo conclu[ií]do|processo encerrado/i.test(latest.description);
        popup.document.write(printPage({ number: processMatch[0].toUpperCase(), events: currentEvents, latest, completed: isComplete }));
        popup.document.close();
      });
      heading.insertAdjacentElement('afterend', button);
    }
  }
  const observedDocuments = new WeakSet();
  const observedFrames = new WeakSet();
  const observers = new Set();
  function observeDocuments() {
    for (const doc of documents()) {
      if (doc.documentElement && !observedDocuments.has(doc)) {
        observedDocuments.add(doc);
        const observer = new MutationObserver(() => {
          mount();
          observeDocuments();
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
        observers.add(observer);
      }
      for (const frame of doc.querySelectorAll('iframe,frame')) {
        if (observedFrames.has(frame)) continue;
        observedFrames.add(frame);
        frame.addEventListener('load', () => {
          mount();
          observeDocuments();
        });
      }
    }
  }
  mount();
  observeDocuments();
  window.addEventListener('pagehide', () => {
    for (const observer of observers) observer.disconnect();
    observers.clear();
  }, { once: true });
})();