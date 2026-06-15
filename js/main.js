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
  obterConfigUsuario,
  salvarConfigUsuario,
  obterInspiracoes,
  salvarInspiracoes,
  obterProvas
} from './database.js';
import { normalizarTexto, exportarCSV, selecionarFragmentosUrgentesOuRecentes } from './utils.js';
import { mostrarToast, confirmar } from './components/toast.js';

// ------------------- IMPORTAÇÕES DOS MÓDULOS -------------------
import {
  carregarFragmentos,
  todosOsFragmentos,
  fragmentosData,
  renderTabela,
  calcularAura,
  handleNovoFragmento,
  configurarEventosTabela,
  atualizarContadorFragmentosTotal,
  calcularMetricasFragmentos
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
  gerarLogDeRevisoes,
  inicializarPaginacaoDashboard,
} from './modules/dashboard.js';
import { initAutocompleteTema, inicializarAutocompleteTema } from './components/autocomplete.js';
import { inicializarDuas, setItensAtivos, getItensAtivos, rerenderDua, duasPadrao } from './components/duas.js';
import { gerarHeatmapSimples } from './components/heatmap.js';
import { inicializarPomodoro } from './components/pomodoro.js';
import { calcularAuraProva } from './modules/provas.js';

let ultimaProva = null;
let paginacaoDashboard = null;

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
          // Re-query: modal.html é carregado via fetch assíncrono, pode não estar pronto ainda
          const mostrarModal = () => {
            const m = document.getElementById('modal-nome');
            if (m) {
              m.classList.add("ativo");
              m.style.display = "flex";
            } else {
              setTimeout(mostrarModal, 50);
            }
          };
          mostrarModal();
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

        // Carrega fragmentos e provas
        try {
          await carregarFragmentos();
        } catch (err) {
          console.error('Erro ao carregar fragmentos:', err.message);
        }

        if (window.location.pathname.includes('home.html')) {
          try {
            const provas = await obterProvas(uid);
            if (provas && provas.length) {
              const sorted = [...provas].sort((a, b) => new Date(b.data) - new Date(a.data));
              ultimaProva = sorted[0];
              ultimaProva.aura = calcularAuraProva(ultimaProva);
            }
          } catch (err) {
            console.error('Erro ao carregar provas:', err.message);
          }
        }

        await exibirTemasCurados();
        configurarEventosTabela(el.tbody, excluirFragmentoPorId, el);

        if (window.location.pathname.includes('home.html') && !paginacaoDashboard) {
          paginacaoDashboard = inicializarPaginacaoDashboard(
            el.tbody,
            document.getElementById('home-paginacao-anterior'),
            document.getElementById('home-pagina-atual'),
            document.getElementById('home-total-paginas'),
            document.getElementById('home-paginacao-proximo')
          );
        }

        atualizarTudo(el, fragmentosData);

        if (el.heatmapContainer) gerarHeatmapSimples(el.heatmapContainer, fragmentosData);

        // Inspirações: carrega do Firestore (semeia com padrões se vazio)
        let inspiracoes = await obterInspiracoes(uid).catch(() => null);
        if (!inspiracoes) {
          inspiracoes = duasPadrao;
          await salvarInspiracoes(uid, inspiracoes).catch(() => {});
        }
        setItensAtivos(inspiracoes);
        rerenderDua();

        inicializarEdicaoContagem(uid, config);
        inicializarEdicaoInspiracoes(uid);

      } else {
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

    // Clicar em hashtag ou aura da tabela popula o filtro
    if (el.filtroInput && el.tbody) {
      const AURAS = new Set(['urgente', 'instavel', 'estavel', 'consolidada']);
      el.tbody.addEventListener('click', (e) => {
        const span = e.target.closest('.hashtag-clicavel');
        if (span) {
          el.filtroInput.value = '#' + span.dataset.tag;
          el.filtroInput.dispatchEvent(new Event('input'));
          return;
        }
        const td = e.target.closest('td.aura');
        if (td && !td.closest('tr.modo-edicao')) {
          const aura = [...td.classList].find(c => AURAS.has(c));
          if (aura) {
            el.filtroInput.value = aura;
            el.filtroInput.dispatchEvent(new Event('input'));
          }
        }
      });

      // Botão limpar filtro
      const btnLimpar = document.getElementById('limpar-filtro');
      if (btnLimpar) {
        el.filtroInput.addEventListener('input', () => {
          btnLimpar.style.display = el.filtroInput.value ? '' : 'none';
        });
        btnLimpar.addEventListener('click', () => {
          el.filtroInput.value = '';
          el.filtroInput.dispatchEvent(new Event('input'));
          btnLimpar.style.display = 'none';
        });
      }
    }

    // -------------------------------------------------------------------------
    // EXPORTAR CSV
    // -------------------------------------------------------------------------
    const btnExportarCSV = document.getElementById('exportar-csv');
    if (btnExportarCSV) {
      btnExportarCSV.addEventListener('click', () => {
        if (!todosOsFragmentos.length) {
          mostrarToast('Nenhum fragmento para exportar.', 'aviso');
          return;
        }
        exportarCSV(todosOsFragmentos);
        mostrarToast('Exportação iniciada!', 'sucesso');
      });
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
      ultimaProvaEl: document.getElementById('ultima-prova-resumo') || null,
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
function atualizarMetricasFragmentos() {
  const m = calcularMetricasFragmentos(todosOsFragmentos);
  const elTotal    = document.getElementById('total-fragmentos-metrica');
  const elUrgentes = document.getElementById('urgentes-fragmentos');
  const elEco      = document.getElementById('eco-medio-fragmentos');
  const elCons     = document.getElementById('consolidados-fragmentos');
  if (elTotal)    elTotal.textContent    = m.total;
  if (elUrgentes) elUrgentes.textContent = m.urgentes;
  if (elEco)      elEco.textContent      = m.ecoMedio != null ? m.ecoMedio + ' %' : '—';
  if (elCons)     elCons.textContent     = m.consolidados;
}

export function atualizarTudo(el, dados) {
  const isHome = window.location.pathname.includes("home.html");

  if (isHome && paginacaoDashboard) {
    paginacaoDashboard.atualizar(selecionarFragmentosUrgentesOuRecentes(dados, dados.length));
  } else {
    renderTabela(dados, el.tbody);
  }

  atualizarContadorFragmentosTotal?.();
  atualizarMetricasFragmentos();

  if (isHome) {
    atualizarMetricasDashboard(dados, el.contadorQuestoes, el.ecoPerformance, el.ultimaEvocacaoElem);
    if (el.logRevisoes) gerarLogDeRevisoes(dados, el.logRevisoes, ultimaProva);
    if (el.ultimaProvaEl) renderUltimaProvaResumo(ultimaProva, el.ultimaProvaEl);
  }
}

function renderUltimaProvaResumo(prova, el) {
  if (!prova) { el.innerHTML = ''; return; }
  const pct = prova.porcentagem ?? Math.round((prova.acertos / prova.total) * 100);
  const data = prova.data ? prova.data.split('-').reverse().join('/') : '—';
  el.innerHTML = `
    <span class="ultima-prova-badge ultima-prova-badge--${prova.aura}">
      ✦ ${prova.nome} · ${data} · ${pct}%
    </span>`;
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

  initAutocompleteTema(input, sugestoes.length ? sugestoes : ['Asma','DPOC','Sepse'], preencherHashtagsDoTema);
  inicializarAutocompleteTema(input);
}

function preencherHashtagsDoTema(tema) {
  const hashtagInput = document.querySelector('input[name="hashtag"]');
  if (!hashtagInput || hashtagInput.value.trim()) return;

  const temaNorm = normalizarTexto(tema);
  const matches = todosOsFragmentos
    .filter(f => normalizarTexto(f.tema) === temaNorm && f.hashtags?.length)
    .sort((a, b) => new Date(b.ultimaRevisao) - new Date(a.ultimaRevisao));

  if (!matches.length) return;

  const tags = matches[0].hashtags.map(t => '#' + t.replace(/^#+/, '')).join(' ');
  hashtagInput.value = tags;
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
  )];

  const AURA_ORDEM = { urgente: 0, instavel: 1, estavel: 2, consolidada: 3 };

  // Mapeia tema → aura do fragmento correspondente
  const auraDoTema = new Map();
  todosOsFragmentos.forEach(f => {
    const slug = normalizarTexto(f.tema || '');
    if (!auraDoTema.has(slug)) auraDoTema.set(slug, calcularAura(f));
  });

  const registrados   = temas.filter(t => auraDoTema.has(normalizarTexto(t)));
  const naoRegistrados = temas.filter(t => !auraDoTema.has(normalizarTexto(t)));

  registrados.sort((a, b) => {
    const oa = AURA_ORDEM[auraDoTema.get(normalizarTexto(a))] ?? 4;
    const ob = AURA_ORDEM[auraDoTema.get(normalizarTexto(b))] ?? 4;
    return oa !== ob ? oa - ob : a.localeCompare(b);
  });
  naoRegistrados.sort((a, b) => a.localeCompare(b));

  const ordenados = [...registrados, ...naoRegistrados];

  ul.innerHTML = ordenados.length
    ? ordenados.map(t => {
        const slug = normalizarTexto(t);
        const registrado = auraDoTema.has(slug);
        const aura = auraDoTema.get(slug) || '';
        return `
          <li class="linha-tema${registrado ? ' tema-registrado' : ''}${aura ? ` tema-aura-${aura}` : ''}">
            <span class="tema">${t}</span>
            <button type="button" class="apagar-tema" data-nome="${t}" title="Remover">✕</button>
          </li>`;
      }).join('')
    : '<li class="hint">Nenhum tema cadastrado ainda.</li>';
}

// -----------------------------------------------------------------------------
// EVENTOS: Selecionar tema curado (preenche o formulário)
// -----------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const span = e.target.closest('.linha-tema .tema');
  if (!span) return;

  const tema = span.textContent.trim();
  const temaInput = document.getElementById('tema-input');
  if (temaInput) temaInput.value = tema;
  preencherHashtagsDoTema(tema);
  temaInput?.focus();
});

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

  if (!await confirmar(`Remover "${nomeBruto}" da lista de temas?`, 'Remover')) return;

  try {
    await apagarTemaCurado(nomeBruto);
    const novos = await obterTemasCurados();
    await salvarTemasCurados(novos);
    await exibirTemasCurados();
    await atualizarSugestoesDeTemas();
  } catch (err) {
    console.error('Erro ao remover tema:', err);
    mostrarToast('Não foi possível remover o tema agora.', 'erro');
  }
});

// =============================================================================
// EDIÇÃO DA CONTAGEM REGRESSIVA
// =============================================================================
function inicializarEdicaoContagem(uid, config) {
  const btnEditar  = document.getElementById('btn-editar-contagem');
  const painel     = document.getElementById('painel-editar-contagem');
  const inputNome  = document.getElementById('edit-prova-nome');
  const inputData  = document.getElementById('edit-prova-data');
  const btnSalvar  = document.getElementById('salvar-contagem');
  const btnCancelar = document.getElementById('cancelar-contagem');
  if (!btnEditar || !painel) return;

  btnEditar.addEventListener('click', () => {
    const visivel = painel.style.display !== 'none';
    painel.style.display = visivel ? 'none' : 'flex';
    if (!visivel) {
      if (inputNome) inputNome.value = config.prova || '';
      if (inputData) inputData.value = config.dataProva || '';
      // Inicializa flatpickr se disponível
      if (window.flatpickr && inputData && !inputData._flatpickr) {
        flatpickr(inputData, { dateFormat: 'Y-m-d', locale: 'pt' });
      }
    }
  });

  btnCancelar?.addEventListener('click', () => {
    painel.style.display = 'none';
  });

  btnSalvar?.addEventListener('click', async () => {
    const novoNome  = inputNome?.value?.trim() || config.prova || '';
    const novaData  = inputData?.value?.trim() || config.dataProva || '';
    const novaConfig = { ...config, prova: novoNome, dataProva: novaData };
    await salvarConfigUsuario(uid, novaConfig).catch(() => {});
    config.prova = novoNome;
    config.dataProva = novaData;

    const subtitulo = document.getElementById('subtitulo-prova');
    const contador  = document.getElementById('contador-dias');
    const { atualizarCountdown } = await import('./modules/dashboard.js');
    atualizarCountdown(contador, subtitulo, novaData, novoNome);

    painel.style.display = 'none';
    mostrarToast('Contagem atualizada!', 'sucesso');
  });
}

// =============================================================================
// EDIÇÃO DAS INSPIRAÇÕES / POST-ITS
// =============================================================================
function inicializarEdicaoInspiracoes(uid) {
  const btnEditar   = document.getElementById('btn-editar-inspiracoes');
  const painel      = document.getElementById('painel-editar-inspiracoes');
  const lista       = document.getElementById('lista-inspiracoes-edit');
  const inpArabe    = document.getElementById('insp-arabe');
  const inpTranslit = document.getElementById('insp-translit');
  const inpTraducao = document.getElementById('insp-traducao');
  const inpEditIdx  = document.getElementById('insp-edit-idx');
  const btnAdd      = document.getElementById('add-inspiracao');
  const btnFechar   = document.getElementById('fechar-editar-inspiracoes');
  if (!btnEditar || !painel) return;

  const limparForm = () => {
    if (inpArabe)    inpArabe.value    = '';
    if (inpTranslit) inpTranslit.value = '';
    if (inpTraducao) inpTraducao.value = '';
    if (inpEditIdx)  inpEditIdx.value  = '';
    if (btnAdd)      btnAdd.textContent = 'Adicionar';
  };

  const renderLista = () => {
    if (!lista) return;
    const itens = getItensAtivos();
    lista.innerHTML = itens.map((item, i) => {
      const label = item.tipo === 'nota'
        ? (item.texto || '—')
        : (item.traducao || item.arabe || '—');
      return `<li data-idx="${i}">
        <span class="inspiracao-texto">${label}</span>
        <button class="btn-editar-inspiracao" data-idx="${i}" title="Editar"></button>
        <button class="btn-remover-inspiracao" data-idx="${i}" title="Remover">✕</button>
      </li>`;
    }).join('');
  };

  btnEditar.addEventListener('click', () => {
    const visivel = painel.style.display !== 'none';
    painel.style.display = visivel ? 'none' : 'flex';
    if (!visivel) { renderLista(); limparForm(); }
  });

  btnFechar?.addEventListener('click', () => {
    painel.style.display = 'none';
    limparForm();
  });

  lista?.addEventListener('click', async (e) => {
    // Editar
    const btnEdit = e.target.closest('.btn-editar-inspiracao');
    if (btnEdit) {
      const idx  = parseInt(btnEdit.dataset.idx, 10);
      const item = getItensAtivos()[idx];
      if (!item) return;
      if (inpArabe)    inpArabe.value    = item.arabe          || '';
      if (inpTranslit) inpTranslit.value = item.transliteracao || '';
      if (inpTraducao) inpTraducao.value = item.traducao ?? item.texto ?? '';
      if (inpEditIdx)  inpEditIdx.value  = idx;
      if (btnAdd)      btnAdd.textContent = 'Salvar edição';
      inpTraducao?.focus();
      return;
    }

    // Remover
    const btnRem = e.target.closest('.btn-remover-inspiracao');
    if (btnRem) {
      const idx   = parseInt(btnRem.dataset.idx, 10);
      const itens = getItensAtivos().filter((_, i) => i !== idx);
      setItensAtivos(itens);
      await salvarInspiracoes(uid, itens).catch(() => {});
      rerenderDua();
      renderLista();
      limparForm();
    }
  });

  btnAdd?.addEventListener('click', async () => {
    const arabe    = inpArabe?.value?.trim()    || '';
    const translit = inpTranslit?.value?.trim() || '';
    const traducao = inpTraducao?.value?.trim() || '';
    if (!arabe && !traducao) return;

    const novoItem = arabe
      ? { tipo: 'dua',  arabe, transliteracao: translit, traducao }
      : { tipo: 'nota', texto: traducao };

    const editIdx = inpEditIdx?.value !== '' ? parseInt(inpEditIdx.value, 10) : -1;
    const itens   = [...getItensAtivos()];

    if (editIdx >= 0) {
      itens[editIdx] = novoItem;
    } else {
      itens.push(novoItem);
    }

    setItensAtivos(itens);
    await salvarInspiracoes(uid, itens).catch(() => {});
    rerenderDua();
    renderLista();
    limparForm();
  });
}

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
