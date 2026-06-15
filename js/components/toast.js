// components/toast.js
// =============================================================================
// Sistema de notificações (toast) e caixa de confirmação customizada
// Substitui alert() e confirm() do navegador.
// =============================================================================

let toastContainer = null;

function obterContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Exibe uma notificação toast temporária.
 * @param {string} mensagem
 * @param {'info'|'sucesso'|'erro'|'aviso'} tipo
 * @param {number} duracao - ms até sumir (padrão 4000)
 */
export function mostrarToast(mensagem, tipo = 'info', duracao = 4000) {
  const container = obterContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  // Força reflow para animação funcionar
  void toast.offsetWidth;
  toast.classList.add('toast-visivel');

  setTimeout(() => {
    toast.classList.remove('toast-visivel');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duracao);
}

/**
 * Caixa de confirmação assíncrona (substitui confirm()).
 * @param {string} mensagem
 * @param {string} labelConfirmar - texto do botão de confirmar
 * @returns {Promise<boolean>}
 */
export function confirmar(mensagem, labelConfirmar = 'Confirmar') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p class="confirm-mensagem">${mensagem}</p>
        <div class="confirm-botoes">
          <button class="confirm-nao">Cancelar</button>
          <button class="confirm-sim">${labelConfirmar}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Foco no botão cancelar por segurança
    setTimeout(() => overlay.querySelector('.confirm-nao')?.focus(), 50);

    overlay.querySelector('.confirm-sim').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('.confirm-nao').onclick = () => { overlay.remove(); resolve(false); };

    // Fecha com Escape
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { overlay.remove(); resolve(false); }
    });
  });
}
