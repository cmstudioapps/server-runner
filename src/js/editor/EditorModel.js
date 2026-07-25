/**
 * EditorModel
 *
 * Responsável APENAS pelo texto puro.
 *
 * - Armazena o conteúdo como string.
 * - Mantém o histórico de alterações.
 * - Fornece métodos para manipular o texto.
 * - NUNCA contém HTML ou marcação de sintaxe.
 *
 * Arquitetura:
 *   Arquivo (.js) → Texto puro → EditorModel → SyntaxHighlighter → HTML → Tela
 *   Ao salvar: EditorModel → Texto puro → Arquivo
 */

class EditorModel {
  constructor(content = '') {
    /** @type {string} Apenas texto puro, SEMPRE */
    this._text = content;
    this._isModified = false;
    this._filePath = null;
    this._fileName = null;
    this._fileInfo = null;
  }

  // ======================== GETTERS / SETTERS ========================

  /** Retorna o texto puro — fonte única da verdade */
  get text() {
    return this._text;
  }

  /** Define o texto puro. Aceita apenas string. */
  set text(value) {
    if (typeof value !== 'string') {
      throw new Error('EditorModel.text deve ser uma string.');
    }
    this._text = value;
  }

  get isModified() {
    return this._isModified;
  }

  set isModified(val) {
    this._isModified = !!val;
  }

  get filePath() {
    return this._filePath;
  }

  get fileName() {
    return this._fileName;
  }

  get fileInfo() {
    return this._fileInfo;
  }

  // ======================== CARREGAR ========================

  /**
   * Carrega o conteúdo de um arquivo.
   * @param {string} filePath - Caminho do arquivo
   * @param {string} fileName - Nome do arquivo
   * @param {string} content - Conteúdo textual
   * @param {object} [info] - Metadados opcionais (size, modifiedAt)
   */
  load(filePath, fileName, content, info = null) {
    this._filePath = filePath;
    this._fileName = fileName;
    this._text = typeof content === 'string' ? content : '';
    this._isModified = false;
    this._fileInfo = info;
  }

  /**
   * Reseta o modelo para o estado inicial.
   */
  reset() {
    this._text = '';
    this._isModified = false;
    this._filePath = null;
    this._fileName = null;
    this._fileInfo = null;
  }

  // ======================== MANIPULAÇÃO ========================

  /**
   * Insere texto em uma posição.
   * @param {number} offset
   * @param {string} insertion
   */
  insertAt(offset, insertion) {
    if (typeof insertion !== 'string') return;
    this._text = this._text.slice(0, offset) + insertion + this._text.slice(offset);
    this._isModified = true;
  }

  /**
   * Remove um trecho do texto.
   * @param {number} start
   * @param {number} end
   */
  removeRange(start, end) {
    this._text = this._text.slice(0, start) + this._text.slice(end);
    this._isModified = true;
  }

  /**
   * Substitui o texto completo (usado no input do contenteditable).
   * @param {string} newText
   */
  replaceAll(newText) {
    if (typeof newText !== 'string') return;
    if (this._text !== newText) {
      this._text = newText;
      this._isModified = true;
    }
  }

  /**
   * Marca como salvo (após persistir no arquivo).
   */
  markSaved() {
    this._isModified = false;
  }
}

// Tornando disponível globalmente (arquivo HTML carrega sem bundler)
window.EditorModel = EditorModel;
