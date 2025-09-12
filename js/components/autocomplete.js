// components/autocomplete.js
/**
 * =============================================================================
 * COMPONENTE AUTOCOMPLETE PARA TEMAS
 * =============================================================================
 * - Sugere temas conforme o usuário digita
 * - Permite navegação com teclado (setas, Enter, Esc)
 * - Fecha automaticamente ao clicar fora
 * =============================================================================
 */

import { normalizarTexto } from '/js/utils.js';

/**
 * Inicializa o autocomplete para um input de tema.
 * Cria dropdown dinâmico abaixo do input com sugestões filtradas.
 *
 * @param {HTMLElement} inputElement - Campo de input alvo
 * @param {Array<string>} suggestions - Lista de temas possíveis
 */
export function initAutocompleteTema(inputElement, suggestions) {
  if (!inputElement) {
    console.warn('Elemento input não fornecido para autocomplete');
    return;
  }

  // Garantir wrapper posicionado (para dropdown absoluto)
  const wrapper = inputElement.parentElement;
  if (getComputedStyle(wrapper).position === 'static') {
    wrapper.style.position = 'relative';
  }

  // Remove dropdown anterior (se já existir)
  const existing = wrapper.querySelector('.ac-dropdown');
  if (existing) existing.remove();

  // Cria novo dropdown
  const drop = document.createElement('div');
  drop.className = 'ac-dropdown';
  wrapper.appendChild(drop);

  // Normaliza lista de sugestões (remove duplicatas, espaços e símbolos inúteis)
  let list = [...new Set(
    suggestions
      .map(t => t.trim())
      .filter(t => t.length > 1 && !/^\W+$/.test(t))
  )];

  let currentIndex = -1; // índice da opção ativa no teclado

  /**
   * Renderiza os itens no dropdown.
   * @param {Array<string>} items - Itens a exibir
   */
  function render(items) {
    drop.innerHTML = '';

    items.forEach((txt) => {
      const li = document.createElement('div');
      li.className = 'ac-item';
      li.textContent = txt;

      // Clique no item → preenche input e fecha dropdown
      li.addEventListener('mousedown', () => {
        inputElement.value = txt;
        close();
      });

      drop.appendChild(li);
    });

    currentIndex = -1;
    if (items.length) open();
    else close();
  }

  /** Abre o dropdown */
  function open() {
    drop.classList.add('open');
    ajustarDropdownTema(inputElement, drop);
  }

  /** Fecha o dropdown */
  function close() {
    drop.classList.remove('open');
  }

  /** Filtra sugestões de acordo com o valor digitado */
  function filter() {
    const q = normalizarTexto(inputElement.value);
    if (!q) {
      render(list.slice(0, 30));
      return;
    }
    const filtered = list
      .filter(t => normalizarTexto(t).includes(q))
      .slice(0, 30);
    render(filtered);
  }

  /**
   * Move a seleção ativa com as setas.
   * @param {number} delta - 1 = baixo | -1 = cima
   */
  function move(delta) {
    const items = drop.querySelectorAll('.ac-item');
    if (!items.length) return;

    currentIndex = (currentIndex + delta + items.length) % items.length;
    items.forEach(el => el.classList.remove('active'));
    items[currentIndex].classList.add('active');
    items[currentIndex].scrollIntoView({ block: 'nearest' });
  }

  /** Seleciona o item atualmente ativo */
  function chooseActive() {
    const el = drop.querySelector('.ac-item.active');
    if (el) {
      inputElement.value = el.textContent;
      close();
    }
  }

  // ---------------------------------------------------------------------------
  // Eventos principais
  // ---------------------------------------------------------------------------

  inputElement.addEventListener('focus', filter);
  inputElement.addEventListener('input', filter);

  inputElement.addEventListener('keydown', (e) => {
    if (!drop.classList.contains('open')) return;

    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); chooseActive(); }
    else if (e.key === 'Escape') { close(); }
  });

  // Fecha ao clicar fora
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) close();
  });

  // Ajusta posição inicial
  ajustarDropdownTema(inputElement, drop);
}

/**
 * Ajusta a posição do dropdown relativo ao input.
 * Calcula coordenadas com base no bounding box.
 *
 * @param {HTMLElement} inputElement - Input alvo
 * @param {HTMLElement} dropdown - Dropdown correspondente
 */
export function ajustarDropdownTema(inputElement, dropdown) {
  if (!inputElement || !dropdown) return;

  const rect = inputElement.getBoundingClientRect();
  const parentRect = inputElement.offsetParent.getBoundingClientRect();

  const top = rect.bottom - parentRect.top + 4;
  const left = rect.left - parentRect.left;

  dropdown.style.position = 'absolute';
  dropdown.style.width = `${rect.width}px`;
  dropdown.style.left = `${left}px`;
  dropdown.style.top = `${top}px`;
  dropdown.style.zIndex = '9999';
}

/**
 * Inicializa listeners auxiliares para reposicionar o dropdown
 * em eventos como digitação, foco ou resize da janela.
 */
export function inicializarAutocompleteTema(inputElement) {
  if (!inputElement) return;

  const atualizar = () => {
    const dropdown = inputElement.parentElement.querySelector('.ac-dropdown');
    ajustarDropdownTema(inputElement, dropdown);
  };

  inputElement.addEventListener('input', atualizar);
  inputElement.addEventListener('focus', atualizar);
  window.addEventListener('resize', atualizar);
}