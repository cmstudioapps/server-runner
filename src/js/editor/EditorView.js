/**
 * EditorView
 *
 * Responsável APENAS pela renderização na tela e interação com o usuário.
 *
 * - RECEBE HTML do SyntaxHighlighter e desenha na tela via innerHTML.
 * - Captura a digitação do usuário e atualiza o EditorModel.
 * - NUNCA é fonte da verdade — sempre consulta EditorModel.text para obter o conteúdo.
 * - NUNCA salva arquivos — delega ao controller.
 * - NUNCA lê innerHTML como conteúdo do arquivo.
 *
 * Fluxo de digitação:
 *   Usuário digita → evento 'input' → EditorView extrai textContent (texto PURO)
 *   → Atualiza EditorModel.replaceAll() → Re-renderiza com SyntaxHighlighter
 *
 * Fluxo de salvamento:
 *   Ctrl+S → EditorModel.text (texto puro) → API de arquivo
 */

const EditorView = (() => {
  'use strict';

  /** @type {HTMLElement} Elemento contenteditable onde o código é exibido */
  let codeEl = null;

  /** @type {HTMLElement} Elemento <pre> que envolve o codeEl */
  let preEl = null;

  /** @type {EditorModel} Referência ao modelo de dados */
  let model = null;

  /** @type {Function} Callback chamado quando o texto muda */
  let onChangeCallback = null;

  /** @type {Function} Callback chamado quando Ctrl+S é pressionado */
  let onSaveCallback = null;

  /** @type {number} Timeout para debounce da re-renderização */
  let renderTimeout = null;

  /** @type {number} Tempo de debounce em ms */
  const RENDER_DEBOUNCE_MS = 250;

  /** @type {boolean} Se está no meio de uma re-renderização */
  let isRendering = false;

  /** @type {{ node: Node, offset: number } | null} Posição do cursor salva */
  let savedCursorPos = null;

  // ======================== INICIALIZAÇÃO ========================

  /**
   * Inicializa a view do editor.
   * @param {HTMLElement} codeElement - O elemento <code contenteditable>
   * @param {EditorModel} editorModel - Instância do EditorModel
   * @param {object} [options]
   * @param {Function} [options.onChange] - Callback quando o texto muda
   * @param {Function} [options.onSave] - Callback para salvar (Ctrl+S)
   */
  function init(codeElement, editorModel, options = {}) {
    if (!codeElement || !editorModel) {
      throw new Error('EditorView.init: codeElement e editorModel são obrigatórios.');
    }

    codeEl = codeElement;
    model = editorModel;
    preEl = codeEl.closest('.files-code-pre') || codeEl.parentElement;
    onChangeCallback = options.onChange || null;
    onSaveCallback = options.onSave || null;

    attachEvents();
  }

  // ======================== RENDERIZAÇÃO ========================

  /**
   * Renderiza o conteúdo do modelo na tela.
   * Usa innerHTML na camada de visualização — isso é correto por design.
   * O modelo de dados permanece como string pura.
   */
  function render() {
    if (!codeEl || !model) return;

    isRendering = true;

    // Salva posição do cursor em offset de caracteres antes de re-renderizar
    savedCursorPos = getCaretOffset(codeEl);

    // Obtém o texto puro do MODELO (fonte da verdade)
    const plainText = model.text;

    // Obtém o HTML highlightado do SyntaxHighlighter
    const filename = model.fileName || '';
    const html = SyntaxHighlighter.highlight(plainText, filename);

    // Renderiza na tela usando innerHTML (camada de visualização)
    codeEl.innerHTML = html;

    // Restaura a posição do cursor
    restoreCursor();

    isRendering = false;
  }

  function restoreCursor() {
    if (savedCursorPos === null || !codeEl) return;
    setCaretOffset(codeEl, savedCursorPos);
    savedCursorPos = null;
  }

  /**
   * Obtém a posição absoluta do cursor baseada em caracteres.
   * Funciona pois forçamos o uso de \n ao invés de <div>.
   */
  function getCaretOffset(element) {
    let caretOffset = 0;
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
  }

  /**
   * Restaura a posição absoluta do cursor caminhando pelos text nodes.
   */
  function setCaretOffset(element, offset) {
    const sel = window.getSelection();
    if (!sel) return;

    let charIndex = 0;
    const range = document.createRange();
    range.setStart(element, 0);
    range.collapse(true);

    const nodeStack = [element];
    let node, foundStart = false;

    while (!foundStart && (node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharIndex = charIndex + node.length;
        if (!foundStart && offset >= charIndex && offset <= nextCharIndex) {
          range.setStart(node, offset - charIndex);
          foundStart = true;
        }
        charIndex = nextCharIndex;
      } else {
        let i = node.childNodes.length;
        while (i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }

    if (foundStart) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // ======================== EVENTOS ========================

  function attachEvents() {
    if (!codeEl) return;

    // Input: usuário digitou — extrair texto PURO e atualizar modelo
    codeEl.addEventListener('input', onInput);

    // Keyboard: atalhos
    codeEl.addEventListener('keydown', onKeyDown);
  }

  /**
   * Handler para evento 'input' do contenteditable.
   *
   * CRÍTICO: NUNCA usa innerHTML como fonte.
   * Usa textContent que retorna APENAS o texto puro visível.
   */
  function onInput() {
    if (isRendering) return;

    // textContent funciona perfeitamente pois forçamos uso de \n (sem divs)
    const rawText = codeEl.textContent || '';

    // Atualiza o modelo com o texto puro
    model.replaceAll(rawText);

    // Notifica mudança
    if (typeof onChangeCallback === 'function') {
      onChangeCallback(model.text);
    }

    // Re-renderiza com debounce (para aplicar highlight na nova digitação)
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
      render();
      renderTimeout = null;
    }, RENDER_DEBOUNCE_MS);
  }

  /**
   * Handler para eventos de teclado.
   * @param {KeyboardEvent} e
   */
  function onKeyDown(e) {
    // Ctrl+S / Cmd+S → Salvar
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const rawText = codeEl.textContent || '';
      model.replaceAll(rawText);

      if (typeof onSaveCallback === 'function') {
        onSaveCallback();
      }
      return;
    }

    // Enter → Quebra de linha pura (evita a criação de <div> pelo contenteditable)
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
      return;
    }

    // Tab → 2 espaços
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
      return;
    }
  }

  // ======================== MÉTODOS PÚBLICOS ========================

  /**
   * Atualiza a view com o conteúdo atual do modelo.
   * Deve ser chamado após carregar um arquivo.
   */
  function refresh() {
    render();
  }

  /**
   * Foca no editor.
   */
  function focus() {
    if (codeEl) codeEl.focus();
  }

  /**
   * Limpa e reseta a view.
   */
  function reset() {
    if (codeEl) {
      codeEl.innerHTML = '';
      codeEl.textContent = '';
    }
    model.reset();
    savedCursorPos = null;
    if (renderTimeout) {
      clearTimeout(renderTimeout);
      renderTimeout = null;
    }
  }

  /**
   * Retorna o texto puro atual do editor (lê do DOM como fallback rápido,
   * mas a fonte da verdade é o EditorModel).
   * @returns {string}
   */
  function getCurrentText() {
    return model.text;
  }

  /**
   * Destroi a view, removendo event listeners.
   */
  function destroy() {
    if (codeEl) {
      codeEl.removeEventListener('input', onInput);
      codeEl.removeEventListener('keydown', onKeyDown);
    }
    if (renderTimeout) {
      clearTimeout(renderTimeout);
      renderTimeout = null;
    }
    codeEl = null;
    preEl = null;
    model = null;
    onChangeCallback = null;
    onSaveCallback = null;
  }

  // ======================== API PÚBLICA ========================

  return {
    init,
    render,
    refresh,
    focus,
    reset,
    getCurrentText,
    destroy,
  };
})();

// Tornando disponível globalmente
window.EditorView = EditorView;
