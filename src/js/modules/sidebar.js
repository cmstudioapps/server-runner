/**
 * Módulo Sidebar - Navegação entre views
 */
const Sidebar = (() => {
  let currentView = 'dashboard';

  function init() {
    const items = document.querySelectorAll('.menu-item');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view) navigateTo(view);
      });
    });
  }

  function navigateTo(view) {
    currentView = view;

    // Atualiza active state
    document.querySelectorAll('.menu-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    // Mostra/esconde views
    document.querySelectorAll('.view').forEach((el) => {
      el.style.display = el.id === `view-${view}` ? 'flex' : 'none';
    });

    console.log(`Navegando para: ${view}`);
  }

  function getCurrentView() {
    return currentView;
  }

  return { init, navigateTo, getCurrentView };
})();
