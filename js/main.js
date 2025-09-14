// =============================================================================
// MAIN.JS
// =============================================================================
// Ponto de entrada principal do Rememorium
// - Escuta autenticação do usuário
// - Inicializa tabelas, dashboard, filtros, paginação, pomodoro, duas
// - Gerencia autocomplete e painel de temas curados
// =============================================================================

// ------------------- IMPORTAÇÕES PRINCIPAIS -------------------
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { 
  auth,
  obterTemasCurados, 
  obterFragmentos, 
  excluirFragmentoPorId,
  salvarTemasCurados, 
  apagarTemaCurado,  
  obterConfigUsuario
} from './database.js';
import { normalizarTexto } from './utils.js';

// ------------------- IMPORTAÇÕES DOS MÓDULOS -------------------
import { 
  carregarFragmentos, 
  todosOsFragmentos,
  fragmentosData,
  renderTabela,
  calcularAura, 
  handleNovoFragmento,
  configurarEventosTabela, 
  atualizarContadorFragmentosTotal
} from './modules/fragmentos.js';
import {
  inicializarSelectCustomizado,
  inicializarDatePicker,
  inicializarFiltros,
  inicializarPaginacao
} from './modules/ui.js';
import {
  atualizarCountdown,
  atualizarMetricasDashboard,
} from './modules/dashboard.js';
import { initAutocompleteTema, inicializarAutocompleteTema } from './components/autocomplete.js';
import { inicializarDuas } from './components/duas.js';
import { gerarHeatmapSimples } from './components/heatmap.js';
import { inicializarPomodoro } from './components/pomodoro.js';

// =============================================================================
// INICIALIZAÇÃO PRINCIPAL
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  inicializarAplicacao();
});

/**
 * Função principal que inicializa toda a aplicação
 */
async function inicializarAplicacao() {
  try {
    const el = obterElementosDOM();
    if (!el) return;

    // Mensagem inicial enquanto carrega fragmentos
    if (el.tbody) {
      el.tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:1rem; font-style:italic; color:#666;">
          <div class="spinner"></div>
            <div>⏳ Carregando fragmentos...</div>
          </td>
        </tr>
      `;
    }

    // -------------------------------------------------------------------------
    // AUTENTICAÇÃO
    // -------------------------------------------------------------------------
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uid = user.uid;
        let config = await obterConfigUsuario(uid);
        if (!config) config = {};

        // Se não houver nome definido → abre modal
        if (!config.nome?.trim()) {
          if (el.modalNome) {
            el.modalNome.classList.add("ativo");
            el.modalNome.style.display = "flex";
          }
          return; // interrompe aqui até preencher
        }

        // Já existe nome → atualiza UI
        if (el.boasVindasEl) {
          const p = el.boasVindasEl.querySelector("p");
          if (p) {
            p.textContent = `Welcome back, ${config.nome}. Your journey to mastery continues.`;
          }
        }

        if (el.subtituloProva) {
          el.subtituloProva.textContent = config.prova || "";
        }

        if (el.contadorSpan && config.dataProva) {
          atualizarCountdown(
            el.contadorSpan,
            el.subtituloProva,
            config.dataProva,
            config.prova
          );
        }

        // Fecha modal se já houver nome
        if (el.modalNome) {
          el.modalNome.classList.remove("ativo");
          el.modalNome.style.display = "none";
        }

        // Carrega fragmentos e UI
        await carregarFragmentos();
        configurarEventosTabela(el.tbody, excluirFragmentoPorId, el);
        atualizarTudo(el, fragmentosData);

        if (el.heatmapContainer) {
          gerarHeatmapSimples(el.heatmapContainer, fragmentosData);
        }

      } else {
        console.warn("⚠️ Nenhum usuário logado, mostrando modal de nome.");
        if (el.modalNome) {
          el.modalNome.classList.add("ativo");
          el.modalNome.style.display = "flex";
        }
      }
    });
      

    // -------------------------------------------------------------------------
    // COMPONENTES DE UI
    // -------------------------------------------------------------------------
    if (el.selectConfianca) inicializarSelectCustomizado(el.selectConfianca);
    if (el.dataInput) inicializarDatePicker(el.dataInput, el.camposRevisao);

    // -------------------------------------------------------------------------
    // FORMULÁRIO: novo fragmento
    // -------------------------------------------------------------------------
    if (el.formNovoFragmento) {
      el.formNovoFragmento.addEventListener("submit", async (e) => {
        e.preventDefault();

        const getVal = (sel) => document.querySelector(sel)?.value?.trim() || "";
        const tema          = getVal("#tema-input") || getVal("[name='tema']");
        const dataRaw       = getVal("#data-input") || getVal("[name='data']");
        const ecoInicialRaw = getVal("[name='ecoInicial']");
        const ecoFinalRaw   = getVal("[name='ecoFinal']");
        const confianca     =
          document.querySelector("#select-confianca .selected-option")?.dataset.value?.trim() ||
          getVal("#confianca") ||
          getVal("[name='confianca']");
        const hashtagsTexto = getVal("#hashtags") || getVal("[name='hashtag']");

        const ok = await handleNovoFragmento({
          tema, dataRaw, ecoInicialRaw, ecoFinalRaw, confianca, hashtagsTexto
        });
        if (!ok) return;

        await carregarFragmentos();
        await atualizarSugestoesDeTemas();
        atualizarTudo(el, fragmentosData);
      });
    }

    // -------------------------------------------------------------------------
    // FILTROS E PAGINAÇÃO
    // -------------------------------------------------------------------------
    if (el.filtroInput || el.ordenarDataBtn || el.filtrarUrgentesBtn) {
      inicializarFiltros(
        el.filtroInput,
        el.ordenarDataBtn,
        el.filtrarUrgentesBtn,
        todosOsFragmentos,
        fragmentosData,
        calcularAura,
        (dados) => renderTabela(dados, el.tbody)
      );
    }

    if (el.selectItens && el.spanPagina && el.anterior && el.proximo && el.spanTotalPaginas) {
      inicializarPaginacao(
        el.selectItens,
        el.spanPagina,
        el.anterior,
        el.proximo,
        el.spanTotalPaginas,
        fragmentosData,
        (dados) => renderTabela(dados, el.tbody)
      );
    }

    // -------------------------------------------------------------------------
    // UTILITÁRIOS
    // -------------------------------------------------------------------------
    if (el.timerDisplay && el.botaoPomodoro) {
      inicializarPomodoro(el.timerDisplay, el.botaoPomodoro);
    }

    if (el.elementoArabe && el.elementoTransliteracao && el.elementoTraducao) {
      inicializarDuas(el.elementoArabe, el.elementoTransliteracao, el.elementoTraducao);
    }

    // Autocomplete
    await atualizarSugestoesDeTemas();
    observarTabelaParaAutocomplete();

  } catch (error) {
    console.error("Erro na inicialização da aplicação:", error);
  }
}

// =============================================================================
// FUNÇÃO PARA OBTER ELEMENTOS DO DOM
// =============================================================================
function obterElementosDOM() {
  try {
    const formNovoFragmento = document.getElementById('form-fragmento');
    return {
      formNovoFragmento,
      tbody: document.querySelector('#fragmentos table tbody'),
      timerDisplay: document.getElementById('pomodoro-timer'),
      botaoPomodoro: document.getElementById('start-pomodoro'),
      selectConfianca: document.querySelector('.select-wrapper'),
      dataInput: document.getElementById('data-input'),
      camposRevisao: document.querySelectorAll('.input-data'),
      heatmapContainer: document.getElementById('heatmap-container'),
      contadorSpan: document.getElementById('contador-dias'),
      temaInput: document.getElementById('tema-input'),
      filtroInput: document.getElementById('filtro-fragmento') || null,
      ordenarDataBtn: document.getElementById('ordenar-data') || null,
      filtrarUrgentesBtn: document.getElementById('filtrar-urgentes') || null,
      selectItens: document.getElementById('itens-por-pagina'),
      spanPagina: document.getElementById('pagina-atual'),
      anterior: document.getElementById('paginacao-anterior'),
      proximo: document.getElementById('paginacao-proximo'),
      spanTotalPaginas: document.getElementById('total-paginas'),
      contadorQuestoes: document.getElementById('contador-questoes') || null,
      ecoPerformance: document.getElementById('eco-performance') || null,
      ultimaEvocacaoElem: document.getElementById('ultima-evocacao') || null,
      logRevisoes: document.getElementById('log-revisoes'),
      boasVindasEl: document.getElementById('boas-vindas') || null,
      modalNome: document.getElementById('modal-nome') || null,
      inputNome: document.getElementById('nomeArcanoInput') || null,
      elementoArabe: document.getElementById('texto-dua-arabe'),
      elementoTransliteracao: document.getElementById('texto-dua-transliteracao'),
      elementoTraducao: document.getElementById('texto-dua-traducao'),
      subtituloProva: document.getElementById('subtitulo-prova') || null
    };
  } catch (error) {
    console.error('Erro ao obter elementos do DOM:', error);
    return null;
  }
}

// =============================================================================
// DASHBOARD (atualizações globais)
// =============================================================================
export function atualizarTudo(el, dados) {
  renderTabela(dados, el.tbody);
  atualizarContadorFragmentosTotal?.();

  if (window.location.pathname.includes("home.html")) {
    atualizarMetricasDashboard(
      dados, 
      el.contadorQuestoes, 
      el.ecoPerformance,
      el.ultimaEvocacaoElem
    );
  }
}

// =============================================================================
// AUTOCOMPLETE (temas)
// =============================================================================
async function atualizarSugestoesDeTemas() {
  const [curados, fragmentos] = await Promise.all([
    obterTemasCurados().catch(() => []),
    obterFragmentos().catch(() => [])
  ]);

  const temasFirebase = [
    ...curados,
    ...fragmentos.map(f => f?.tema).filter(Boolean)
  ];

  const temasDom = Array
    .from(document.querySelectorAll('#fragmentos tbody tr td:nth-child(2)'))
    .map(td => td.textContent.trim())
    .filter(Boolean);

  // Remove duplicados
  const mapa = new Map();
  [...temasFirebase, ...temasDom].forEach(t => {
    const k = normalizarTexto(t);
    if (!mapa.has(k)) mapa.set(k, t);
  });

  const sugestoes = [...mapa.values()].sort((a,b)=>a.localeCompare(b));

  const input = document.getElementById('tema-input');
  if (!input) return;

  initAutocompleteTema(input, sugestoes.length ? sugestoes : ['Asma','DPOC','Sepse']);
  inicializarAutocompleteTema(input);
}

/** Observa mudanças na tabela para atualizar sugestões */
function observarTabelaParaAutocomplete() {
  const tbody = document.querySelector('#fragmentos tbody');
  if (!tbody) return;
  const obs = new MutationObserver(() => atualizarSugestoesDeTemas());
  obs.observe(tbody, { childList: true });
}

// =============================================================================
// PAINEL DE TEMAS CURADOS
// =============================================================================
async function adicionarTema(event) {
  if (event) event.preventDefault();

  const input = document.getElementById('novo-tema');
  const entrada = input?.value?.trim();
  if (!entrada) return;

  const novos = entrada.split(/[;,\n]/).map(t => t.trim()).filter(Boolean);
  const temas = await obterTemasCurados().catch(() => []);
  const setNorm = new Set(temas.map(t => normalizarTexto(t)));

  novos.forEach(novo => {
    const k = normalizarTexto(novo);
    if (!setNorm.has(k)) { temas.push(novo); setNorm.add(k); }
  });

  await salvarTemasCurados(temas);
  input.value = '';
  input.focus();
  await exibirTemasCurados();
  await atualizarSugestoesDeTemas();
}

function abrirPainelTemas() {
  document.getElementById('painel-temas-curados')?.classList.add('ativo');
  if (typeof exibirTemasCurados === 'function') exibirTemasCurados();
}

function fecharPainelTemas() {
  document.getElementById('painel-temas-curados')?.classList.remove('ativo');
}

/** Exibe lista de temas curados no painel lateral */
async function exibirTemasCurados() {
  const ul = document.getElementById('lista-edicao-temas');
  if (!ul) return;

  ul.innerHTML = '<li class="hint">Carregando…</li>';

  let temas = await obterTemasCurados().catch(() => []);
  temas = [...new Set(
    temas.map(t => (t ?? '').toString().trim()).filter(Boolean)
  )].sort((a,b) => a.localeCompare(b));

  ul.innerHTML = temas.length
    ? temas.map(t => `
        <li class="linha-tema">
          <span class="tema">${t}</span>
          <button type="button" class="apagar-tema" data-nome="${t}" title="Remover">✕</button>
        </li>
      `).join('')
    : '<li class="hint">Nenhum tema cadastrado ainda.</li>';
}

// -----------------------------------------------------------------------------
// EVENTOS: Remover tema curado
// -----------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.apagar-tema');
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const nomeBruto = btn.dataset.nome || btn.parentElement?.querySelector('.tema')?.textContent?.trim();
  if (!nomeBruto) return;

  if (!confirm(`Remover "${nomeBruto}" da lista de temas?`)) return;

  try {
    await apagarTemaCurado(nomeBruto);
    const novos = await obterTemasCurados();
    await salvarTemasCurados(novos);
    await exibirTemasCurados();
    await atualizarSugestoesDeTemas();
  } catch (err) {
    console.error('Erro ao remover tema:', err);
    alert('Não foi possível remover o tema agora.');
  }
});

// =============================================================================
// EXPORTS PARA HTML (uso em templates)
// =============================================================================
window.abrirPainelTemas = abrirPainelTemas;
window.fecharPainelTemas = fecharPainelTemas;
window.adicionarTema = adicionarTema;
//window.abrirPainelPrincipal = abrirPainelPrincipal;
//window.carregarFragmentos = carregarFragmentos;
//window.fecharModal = fecharModalNome;
//window.logout = logout;
