// modules/ui.js
/**
 * =============================================================================
 * MÓDULO DE COMPONENTES DE INTERFACE DO USUÁRIO
 * =============================================================================
 * Componentes UI reutilizáveis:
 * - Select customizado
 * - Datepicker
 * - Sistema de filtros
 * - Paginação
 * - Eventos interativos da tabela
 * =============================================================================
 */

import { excluirFragmentoPorId } from "../database.js";
import { calcularPontosAura } from "./fragmentos.js";
import { normalizarTexto } from "../utils.js";
import { confirmar } from "../components/toast.js";

/* ============================================================================
   SELECT CUSTOMIZADO (confiança)
   ============================================================================ */

/**
 * Inicializa select customizado para confiança.
 * Substitui o select padrão por lista de opções estilizadas.
 * @param {HTMLElement} selectElement - Wrapper do select customizado
 */
export function inicializarSelectCustomizado(selectElement) {
  if (!selectElement) return;

  const select = document.getElementById('select-confianca');
  const options = select.querySelector('.select-options');
  const selected = select.querySelector('.selected-option');
  const arrow = selectElement.querySelector('.arrow');

  // Inicia escondido
  options.style.display = 'none';

  // Toggle abrir/fechar lista de opções
  selectElement.addEventListener('click', (e) => {
    e.stopPropagation();
    const isAberto = options.style.display === 'block';
    options.style.display = isAberto ? 'none' : 'block';

    // Rotaciona seta
    if (arrow) {
      arrow.style.transform = isAberto
        ? 'translateY(-50%) rotate(0deg)'
        : 'translateY(-50%) rotate(180deg)';
    }
  });

  // Clique em opção → atualiza valor selecionado
  options.querySelectorAll('li').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const valor = option.dataset.value;
      selected.textContent = option.textContent;
      selected.dataset.value = valor;
      options.style.display = 'none';

      // Reseta seta
      if (arrow) {
        arrow.style.transform = 'translateY(-50%) rotate(0deg)';
      }
    });
  });

  // Fecha se clicar fora
  document.addEventListener('click', e => {
    if (!selectElement.contains(e.target)) {
      options.style.display = 'none';
      if (arrow) arrow.style.transform = 'translateY(-50%) rotate(0deg)';
    }
  });
}

/* ============================================================================
   DATEPICKER (flatpickr para inputs de data)
   ============================================================================ */

/**
 * Inicializa datepickers nos campos de data (flatpickr).
 * @param {HTMLElement} inputPrincipal - Input principal de data
 * @param {NodeList} camposRevisao - Lista de inputs de data de revisão
 */
export function inicializarDatePicker(inputPrincipal, camposRevisao) {
  // Configuração principal
  if (inputPrincipal) {
    flatpickr(inputPrincipal, {
      dateFormat: "Y-m-d",
      disableMobile: true,
      locale: {
        weekdays: {
          shorthand: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
          longhand: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
        },
        months: {
          shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
          longhand: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
        },
      }
    });
  }

  // Configuração para campos extras de revisão
  if (camposRevisao && camposRevisao.length > 0) {
    camposRevisao.forEach(input => {
      flatpickr(input, {
        dateFormat: "Y-m-d",
        disableMobile: true,
        locale: {
          weekdays: {
            shorthand: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
            longhand: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
          },
          months: {
            shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
            longhand: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
          },
        },
        onOpen: function (_, __, instance) {
          // Ajusta margem visual
          instance.calendarContainer.style.marginTop = "-15px";
        }
      });
    });
  }
}

/* ============================================================================
   SISTEMA DE FILTROS (texto, data, urgência)
   ============================================================================ */

/**
 * Inicializa sistema de filtros da tabela.
 */
export function inicializarFiltros(
  filtroInput, ordenarDataBtn, filtrarUrgentesBtn,
  todosOsFragmentos, fragmentosData, calcularAura, renderTabela
) {
  let filtroUrgenteAtivo = false;

  // 🔎 Filtro por texto (com debounce de 300ms)
  if (filtroInput) {
    let debounceTimer;
    filtroInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      const valor = this.value;
      debounceTimer = setTimeout(() => {
        filtrarTabela(valor, todosOsFragmentos, fragmentosData, calcularAura, renderTabela);
      }, 300);
    });
  }

  // 📅 Ordenação por data (asc/desc)
  if (ordenarDataBtn) {
    if (!ordenarDataBtn.dataset.ordem) ordenarDataBtn.dataset.ordem = 'desc';
    ordenarDataBtn.addEventListener('click', () => {
      const cur = ordenarDataBtn.dataset.ordem === 'asc' ? 'asc' : 'desc';
      const prox = cur === 'asc' ? 'desc' : 'asc';
      ordenarDataBtn.dataset.ordem = prox;
      ordenarDataBtn.textContent = prox === 'asc' ? 'Data ↑' : 'Data ↓';
      ordenarPorData(fragmentosData, renderTabela, prox);
    });
  }

  // ⚡ Urgentes no topo / restaurar por data
  if (filtrarUrgentesBtn) {
    filtrarUrgentesBtn.addEventListener('click', function () {
      const rotulo = this.querySelector('.rotulo-pequeno');
      if (!filtroUrgenteAtivo) {
        // Ordena por prioridade da aura
        fragmentosData.forEach(f => f.aura = calcularAura(f));
        const ordem = { urgente: 0, instavel: 1, estavel: 2, consolidada: 3 };
        fragmentosData.sort((a, b) => {
          const oa = ordem[normalizarTexto(a.aura)] ?? 4;
          const ob = ordem[normalizarTexto(b.aura)] ?? 4;
          if (oa !== ob) return oa - ob;
          return calcularPontosAura(b) - calcularPontosAura(a);
        });
        this.classList.add('ativo');
        if (rotulo) rotulo.textContent = 'filtrar por data';
        filtroUrgenteAtivo = true;
        renderTabela(fragmentosData);
      } else {
        // Restaura ordem por data
        fragmentosData.splice(0, fragmentosData.length, ...todosOsFragmentos);
        ordenarPorData(fragmentosData, renderTabela, (ordenarDataBtn?.dataset.ordem || 'desc'));
        this.classList.remove('ativo');
        if (rotulo) rotulo.textContent = 'filtrar urgentes';
        filtroUrgenteAtivo = false;
      }
    });
  }
}

/** Filtro por texto (mantém referência do array principal). */
export function filtrarTabela(termo, todosOsFragmentos, fragmentosData, calcularAura, renderTabela) {
  const termoNorm = normalizarTexto(termo || '');
  const filtrados = todosOsFragmentos.filter(f => {
    const aura = calcularAura(f);
    const textoNorm = normalizarTexto(
      `${f?.tema || ''} ${aura || ''} ${f?.confianca || ''} ${(f?.hashtags || []).map(t => '#' + t.replace(/^#+/, '')).join(' ')}`
    );
    return textoNorm.includes(termoNorm);
  });
  fragmentosData.splice(0, fragmentosData.length, ...filtrados);
  renderTabela(fragmentosData);
}

/** Ordena por data (mais recentes primeiro por padrão). */
export function ordenarPorData(fragmentosData, renderTabela, direcao = 'desc') {
  fragmentosData.sort((a, b) => {
    const dA = Date.parse(a?.ultimaRevisao || a?.data || '') || -Infinity;
    const dB = Date.parse(b?.ultimaRevisao || b?.data || '') || -Infinity;
    return direcao === 'asc' ? dA - dB : dB - dA;
  });
  renderTabela(fragmentosData);
}

/* ============================================================================
   PAGINAÇÃO
   ============================================================================ */

/**
 * Inicializa sistema de paginação da tabela.
 */
export function inicializarPaginacao(
  selectItens, spanPagina, anterior, proximo, spanTotalPaginas,
  fragmentosData, renderTabela
) {
  let paginaAtual = 0;
  let fragmentosPorPagina = 20;

  // Select de itens por página
  if (selectItens) {
    selectItens.value = String(fragmentosPorPagina);
    selectItens.onchange = (e) => {
      fragmentosPorPagina = parseInt(e.target.value, 10);
      paginaAtual = 0;
      atualizarPaginas();
    };
  }

  // Botão anterior
  if (anterior) {
    anterior.onclick = () => {
      if (paginaAtual > 0) {
        paginaAtual--;
        atualizarPaginas();
      }
    };
  }

  // Botão próximo
  if (proximo) {
    proximo.onclick = () => {
      if (paginaAtual < Math.ceil(fragmentosData.length / fragmentosPorPagina) - 1) {
        paginaAtual++;
        atualizarPaginas();
      }
    };
  }

  // Atualiza UI da paginação
  function atualizarPaginas() {
    if (!Array.isArray(fragmentosData) || fragmentosData.length === 0) {
      renderTabela([]);
      return;
    }

    const totalPaginas = Math.ceil(fragmentosData.length / fragmentosPorPagina);

    if (paginaAtual >= totalPaginas && totalPaginas > 0) {
      paginaAtual = totalPaginas - 1;
    }

    const inicio = paginaAtual * fragmentosPorPagina;
    const fim = inicio + fragmentosPorPagina;
    const fragmentosVisiveis = fragmentosData.slice(inicio, fim);

    renderTabela(fragmentosVisiveis);

    if (spanPagina) spanPagina.textContent = String(paginaAtual + 1);
    if (anterior) anterior.classList.toggle('disabled', paginaAtual === 0);
    if (proximo) proximo.classList.toggle('disabled', paginaAtual >= totalPaginas - 1);
    if (spanTotalPaginas) spanTotalPaginas.textContent = `/ ${totalPaginas}`;
  }

  // Inicialização
  atualizarPaginas();
}

/* ============================================================================
   EVENTOS DA TABELA (histórico e exclusão)
   ============================================================================ */

/**
 * Liga eventos interativos da tabela.
 * - Toggle do histórico (linha oculta)
 * - Exclusão de fragmentos
 * @param {HTMLElement} tbody - Corpo da tabela
 * @param {Function} onAfterDelete - Callback chamado após exclusão
 */
export function ligarEventosTabela(tbody, onAfterDelete) {
  if (!tbody || tbody.__delegado) return; // evita múltiplos binds
  tbody.__delegado = true;

  tbody.addEventListener('click', async (e) => {
    // --- HISTÓRICO (toggle de linha oculta ou modal edição) ---
    const btnHist = e.target.closest('.botao-historico');
    if (btnHist && tbody.contains(btnHist)) {
      const tr = btnHist.closest('tr');
      const trHist = tr?.nextElementSibling;
      if (trHist && trHist.classList.contains('linha-historico')) {
        const visivel = trHist.style.display !== 'none';
        trHist.style.display = visivel ? 'none' : 'table-row';
      } else {
        if (typeof window.abrirModalEdicao === 'function') {
          window.abrirModalEdicao(btnHist.dataset.id);
        }
      }
      return;
    }

    // --- EXCLUSÃO DE FRAGMENTO ---
    const btnExc = e.target.closest('.botao-excluir');
    if (btnExc && tbody.contains(btnExc)) {
      const id = btnExc.dataset.id;
      const tr = btnExc.closest('tr');
      const nomeTema = tr?.querySelector('td:nth-child(2)')?.textContent.trim() || 'Tema desconhecido';

      if (id && await confirmar(`Excluir o fragmento "${nomeTema}"? Esta ação não pode ser desfeita.`, 'Excluir')) {
        try {
          await excluirFragmentoPorId(id, btnExc);   // apaga no Firestore
          onAfterDelete?.(id);                      // main.js cuida do re-render
        } catch (err) {
          console.error('Erro ao excluir fragmento:', err);
        }
      }
      return;
    }
  });
}