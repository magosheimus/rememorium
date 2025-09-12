// components/pomodoro.js
/**
 * =============================================================================
 * COMPONENTE POMODORO TIMER
 * =============================================================================
 * - Gerencia o temporizador Pomodoro (técnica de estudo com intervalos).
 * - Funcionalidade básica: iniciar, pausar e reiniciar ciclos de 25 minutos.
 * - Exibe o tempo restante no display e alerta ao final.
 * =============================================================================
 */

/**
 * Inicializa o Pomodoro Timer.
 *
 * @param {HTMLElement} timerDisplay - Elemento onde o tempo é exibido (mm:ss).
 * @param {HTMLElement} botaoPomodoro - Botão que inicia/pausa o temporizador.
 */
export function inicializarPomodoro(timerDisplay, botaoPomodoro) {
  if (!timerDisplay || !botaoPomodoro) {
    console.warn('Elementos do Pomodoro não encontrados.');
    return;
  }

  // ---------------------------------------------------------------------------
  // Estado interno
  // ---------------------------------------------------------------------------
  let pomodoroTempo = 25 * 60;       // Tempo inicial: 25 minutos (em segundos)
  let pomodoroIntervalo = null;      // ID do setInterval (para controle/pausa)
  let pomodoroAtivo = false;         // Flag indicando se está rodando

  // ---------------------------------------------------------------------------
  // Funções auxiliares
  // ---------------------------------------------------------------------------

  /**
   * Formata segundos para string no formato mm:ss.
   * @param {number} segundos - Segundos restantes
   * @returns {string} Tempo formatado
   */
  function formatarTempo(segundos) {
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  /** Atualiza o display do timer. */
  function atualizarDisplay() {
    timerDisplay.textContent = formatarTempo(pomodoroTempo);
  }

  // ---------------------------------------------------------------------------
  // Lógica principal
  // ---------------------------------------------------------------------------

  /** Inicia ou pausa o Pomodoro. */
  function iniciarOuPausarPomodoro() {
    if (pomodoroAtivo) {
      // Pausar ⏸
      clearInterval(pomodoroIntervalo);
      pomodoroAtivo = false;
    } else {
      // Rodar ▶
      pomodoroAtivo = true;
      pomodoroIntervalo = setInterval(() => {
        if (pomodoroTempo > 0) {
          pomodoroTempo--;
          atualizarDisplay();
        } else {
          // Fim do ciclo
          clearInterval(pomodoroIntervalo);
          pomodoroAtivo = false;
          alert('⏰ Tempo do Pomodoro finalizado!');
          pomodoroTempo = 25 * 60; // Reinicia automaticamente
          atualizarDisplay();
        }
      }, 1000);
    }
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  botaoPomodoro.addEventListener("click", iniciarOuPausarPomodoro);

  // ---------------------------------------------------------------------------
  // Inicialização
  // ---------------------------------------------------------------------------
  atualizarDisplay(); // Exibe "25:00" no início
}