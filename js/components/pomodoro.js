// components/pomodoro.js
const STORAGE_KEY = 'pomodoro-config';

function carregarConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

export function inicializarPomodoro(timerDisplay, botaoPomodoro) {
  if (!timerDisplay || !botaoPomodoro) return;

  const cfg = carregarConfig();
  let minEstudo = cfg.estudo ?? 25;
  let minPausa  = cfg.pausa  ?? 5;

  let fase      = 'estudo';
  let tempo     = minEstudo * 60;
  let intervalo = null;
  let ativo     = false;

  const faseLabel = document.getElementById('pomodoro-fase');

  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function render() {
    timerDisplay.textContent = fmt(tempo);
    if (faseLabel) faseLabel.textContent = fase === 'estudo' ? 'Estudo' : 'Pausa';
    timerDisplay.dataset.fase = fase;
  }

  function avancarFase() {
    clearInterval(intervalo);
    ativo = false;
    fase  = fase === 'estudo' ? 'pausa' : 'estudo';
    tempo = (fase === 'estudo' ? minEstudo : minPausa) * 60;
    render();
  }

  function tick() {
    if (tempo > 0) { tempo--; render(); }
    else avancarFase();
  }

  function toggleTimer() {
    if (ativo) { clearInterval(intervalo); ativo = false; }
    else       { ativo = true; intervalo = setInterval(tick, 1000); }
  }

  botaoPomodoro.addEventListener('click', toggleTimer);

  // ── Modal de configuração ──────────────────────────────────────────────────
  const modal       = document.getElementById('modal-pomodoro');
  const btnCfg      = document.getElementById('pomodoro-config-btn');
  const inputEstudo = document.getElementById('pomodoro-estudo-min');
  const inputPausa  = document.getElementById('pomodoro-pausa-min');
  const btnSalvar   = document.getElementById('pomodoro-salvar-config');
  const btnFechar   = modal?.querySelector('.modal-fechar');

  function abrirModal() {
    if (!modal) return;
    inputEstudo.value = minEstudo;
    inputPausa.value  = minPausa;
    modal.style.display = 'flex';
  }

  function fecharModal() {
    if (modal) modal.style.display = 'none';
  }

  btnCfg?.addEventListener('click', abrirModal);
  btnFechar?.addEventListener('click', fecharModal);
  modal?.addEventListener('click', e => { if (e.target === modal) fecharModal(); });

  btnSalvar?.addEventListener('click', () => {
    const novoEstudo = Math.max(1, parseInt(inputEstudo.value, 10) || 25);
    const novaPausa  = Math.max(1, parseInt(inputPausa.value,  10) || 5);
    minEstudo = novoEstudo;
    minPausa  = novaPausa;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ estudo: minEstudo, pausa: minPausa }));

    clearInterval(intervalo);
    ativo = false;
    tempo = (fase === 'estudo' ? minEstudo : minPausa) * 60;
    render();
    fecharModal();
  });

  render();
}
