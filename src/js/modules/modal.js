/**
 * Módulo Modal - Gerenciamento do modal "Add Server"
 */
const AddServerModal = (() => {
  let isOpen = false;

  function init() {
    const overlay = document.getElementById('modal-overlay');
    const btnAdd = document.getElementById('btn-add-server');
    const btnClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('btn-cancel');
    const btnSave = document.getElementById('btn-save');
    const btnBrowse = document.getElementById('btn-browse');
    const uploadArea = document.getElementById('upload-area');

    // Abrir modal (botão do header e do empty state)
    btnAdd.addEventListener('click', () => open());
    const btnEmptyAdd = document.getElementById('btn-empty-add');
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', () => open());

    // Fechar modal
    btnClose.addEventListener('click', () => close());
    btnCancel.addEventListener('click', () => close());

    // Fechar ao clicar fora
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });

    // Selecionar pasta
    btnBrowse.addEventListener('click', async () => {
      const folder = await window.api.selectFolder();
      if (folder) {
        document.getElementById('input-path').value = folder;

        // Auto-preenche nome baseado no nome da pasta
        const nameInput = document.getElementById('input-name');
        if (!nameInput.value) {
          const folderName = folder.split(/[\\/]/).pop();
          nameInput.value = folderName;
        }

        // Detecta configuração automaticamente
        try {
          const detected = await window.api.detectProject(folder);
          if (detected) {
            if (detected.entryFile && !document.getElementById('input-entry').value) {
              document.getElementById('input-entry').value = detected.entryFile;
            }
            if (detected.startCommand && !document.getElementById('input-command').value) {
              document.getElementById('input-command').value = detected.startCommand;
            }
            if (detected.port && document.getElementById('input-port').value === '3000') {
              document.getElementById('input-port').value = String(detected.port);
            }
          }
        } catch (err) {
          console.error('Erro ao detectar projeto:', err);
        }
      }
    });

    // Upload area (placeholder visual)
    uploadArea.addEventListener('click', () => {
      // Por enquanto, redireciona para selecionar pasta
      btnBrowse.click();
    });

    // Salvar
    btnSave.addEventListener('click', async () => {
      const name = document.getElementById('input-name').value.trim();
      const projectPath = document.getElementById('input-path').value.trim();
      const entryFile = document.getElementById('input-entry').value.trim();
      const port = parseInt(document.getElementById('input-port').value) || 3000;
      const startCommand = document.getElementById('input-command').value.trim();

      if (!name || !projectPath) {
        highlightField(!name ? 'input-name' : 'input-path');
        return;
      }

      // Monta comando padrão se vazio
      const finalCommand = startCommand || (entryFile ? `node ${entryFile}` : 'npm start');

      try {
        const server = await window.api.addServer({
          name,
          projectPath,
          entryFile,
          port,
          startCommand: finalCommand,
        });

        Dashboard.addServer(server);
        close();
        resetForm();
      } catch (err) {
        console.error('Erro ao adicionar servidor:', err);
      }
    });
  }

  function open() {
    isOpen = true;
    document.getElementById('modal-overlay').classList.add('open');
  }

  function close() {
    isOpen = false;
    document.getElementById('modal-overlay').classList.remove('open');
  }

  function resetForm() {
    document.getElementById('input-name').value = '';
    document.getElementById('input-path').value = '';
    document.getElementById('input-entry').value = '';
    document.getElementById('input-port').value = '3000';
    document.getElementById('input-command').value = '';
  }

  function highlightField(id) {
    const el = document.getElementById(id);
    el.style.borderColor = 'var(--red)';
    el.focus();
    setTimeout(() => {
      el.style.borderColor = '';
    }, 2000);
  }

  return { init, open, close };
})();
