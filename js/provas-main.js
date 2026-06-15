// provas-main.js
// =============================================================================
// Entry point da página provas.html
// =============================================================================

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { auth } from './database.js';
import { logout } from './modules/auth.js';
import { inicializarDatePicker } from './modules/ui.js';
import {
  carregarProvas,
  todasAsProvas,
  renderTabelaProvas,
  handleNovaProva,
  handleExcluirProva,
  calcularMetricasProvas,
  configurarEventosProvas,
} from './modules/provas.js';

// Expõe logout para botão no HTML
window.logout = logout;

document.addEventListener('DOMContentLoaded', () => {
  inicializarPagina();
})


async function inicializarPagina() {
  const dataInput = document.getElementById('data-prova-input');
  if (dataInput) inicializarDatePicker(dataInput);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    await carregarProvas();
    renderizar();
    configurarFormulario();
    configurarFiltro();
  });
}

function renderizar() {
  const tbody = document.getElementById('provas-tbody');
  const filtradas = filtrarProvas();
  renderTabelaProvas(filtradas, tbody);
  atualizarMetricas();
  configurarEventosProvas(tbody, todasAsProvas, renderizar);
}

function atualizarMetricas() {
  const m = calcularMetricasProvas(todasAsProvas);

  const elTotal = document.getElementById('total-provas');
  const elMedia = document.getElementById('media-provas');
  const elMelhor = document.getElementById('melhor-prova');
  const elPior = document.getElementById('pior-prova');
  const elContador = document.getElementById('contador-provas');

  if (elTotal) elTotal.textContent = m.totalProvas;
  if (elMedia) elMedia.textContent = m.mediaGeral + ' %';
  if (elMelhor) elMelhor.textContent = m.melhor ? `${m.melhor.nome} (${m.melhor.porcentagem}%)` : '—';
  if (elPior) elPior.textContent = m.pior ? `${m.pior.nome} (${m.pior.porcentagem}%)` : '—';
  if (elContador) elContador.textContent = m.totalProvas;
}

function configurarFormulario() {
  const form = document.getElementById('form-prova');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = form.querySelector('[name="nome"]')?.value?.trim() || '';
    const data = form.querySelector('[name="data"]')?.value?.trim() || '';
    const acertos = form.querySelector('[name="acertos"]')?.value?.trim() || '';
    const total = form.querySelector('[name="total"]')?.value?.trim() || '';
    const hashtagsTexto = form.querySelector('[name="hashtag"]')?.value?.trim() || '';

    const ok = await handleNovaProva({ nome, data, acertos, total, hashtags: hashtagsTexto });
    if (ok) {
      form.reset();
      const dp = document.getElementById('data-prova-input');
      if (dp && dp._flatpickr) dp._flatpickr.clear();
      if (selectEl) {
        const sel = selectEl.querySelector('.selected-option');
        if (sel) { sel.textContent = 'Selecionar'; delete sel.dataset.value; }
      }
      renderizar();
    }
  });
}


let filtroAtivo = '';
let mostrarUrgentes = false;

function configurarFiltro() {
  const inputFiltro = document.getElementById('filtro-prova');
  if (inputFiltro) {
    let debounce;
    inputFiltro.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        filtroAtivo = inputFiltro.value.toLowerCase().trim();
        renderizar();
      }, 300);
    });
  }

  const btnUrgentes = document.getElementById('filtrar-urgentes-provas');
  if (btnUrgentes) {
    btnUrgentes.addEventListener('click', () => {
      mostrarUrgentes = !mostrarUrgentes;
      btnUrgentes.classList.toggle('ativo', mostrarUrgentes);
      renderizar();
    });
  }
}

function filtrarProvas() {
  let lista = [...todasAsProvas];
  if (mostrarUrgentes) lista = lista.filter(p => p.aura === 'urgente');
  if (filtroAtivo) lista = lista.filter(p => p.nome.toLowerCase().includes(filtroAtivo));
  return lista;
}
