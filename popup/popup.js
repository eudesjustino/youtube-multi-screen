(() => {
  const SELECTORS = {
    CLOSE_POPUP: '#closePopup',
    MOVE_BUTTON: '#moveButton',
    CLOSE_BUTTON: '#closeButton',
    FULLSCREEN_BUTTON: '#fullscreenButton',
  };

  const Logger = {
    info: (message, ...args) => console.log(`INFO: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`WARN: ${message}`, ...args),
    error: (message, ...args) => console.error(`ERROR: ${message}`, ...args),
  };

  const DOMUtils = {
    /**
     * Retorna o elemento DOM pelo seletor.
     * @param {string} selector
     * @returns {HTMLElement|null}
     */
    getElement(selector) {
      return document.querySelector(selector);
    },

    /**
     * Mostra notificações na interface do popup.
     * @param {string} message - Mensagem da notificação.
     * @param {string} type - Tipo da notificação (success, error).
     */
    showNotification(message, type) {
      const notification = DOMUtils.getElement('#notification');
      if (!notification) {
        Logger.warn('DOMUtils: Elemento de notificação não encontrado.');
        return;
      }
      notification.textContent = message;
      notification.className = `notification ${type}`;
      notification.style.display = 'block';

      setTimeout(() => {
        notification.style.display = 'none';
      }, 3000);
    },
  };

  const TabUtils = {
    /**
     * Retorna a aba ativa do YouTube.
     * @returns {Promise<chrome.tabs.Tab|null>}
     */
    async getActiveYouTubeTab() {
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
          url: '*://*.youtube.com/*',
        });
        Logger.info(`TabUtils: Abas do YouTube encontradas: ${tabs.length}`);
        return tabs[0] || null;
      } catch (error) {
        Logger.error('TabUtils: Erro ao buscar aba ativa do YouTube:', error);
        return null;
      }
    },

    /**
     * Retorna o título da aba pelo ID.
     * @param {number} tabId
     * @returns {Promise<string>}
     */
    async getTabTitle(tabId) {
      try {
        const tab = await chrome.tabs.get(tabId);
        return tab.title || 'Título desconhecido';
      } catch (error) {
        Logger.error(`TabUtils: Erro ao obter título da aba ${tabId}:`, error);
        return 'Título desconhecido';
      }
    },
  };

  const PopupManager = {
    /**
     * Inicializa os listeners e configurações do popup.
     */
    init() {
      document.addEventListener('DOMContentLoaded', this.updateActiveTabInfo.bind(this));

      chrome.tabs.onActivated.addListener(this.updateActiveTabInfo.bind(this));
      chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'complete') {
          this.updateActiveTabInfo();
        }
      });

      this.addEventListeners();
    },

    /**
     * Adiciona os listeners para os botões do popup.
     */
    addEventListeners() {
      const closePopupButton = DOMUtils.getElement(SELECTORS.CLOSE_POPUP);
      const moveButton = DOMUtils.getElement(SELECTORS.MOVE_BUTTON);
      const closeButton = DOMUtils.getElement(SELECTORS.CLOSE_BUTTON);
      const fullscreenButton = DOMUtils.getElement(SELECTORS.FULLSCREEN_BUTTON);

      closePopupButton.addEventListener('click', () => window.close());
      moveButton.addEventListener('click', this.handleMoveButton.bind(this));
      closeButton.addEventListener('click', this.handleCloseButton.bind(this));
      fullscreenButton.addEventListener('click', this.handleFullscreenButton.bind(this));
    },

    /**
     * Atualiza as informações sobre a aba ativa do YouTube no popup.
     */
    async updateActiveTabInfo() {
      const activeTab = await TabUtils.getActiveYouTubeTab();
      const moveButton = DOMUtils.getElement(SELECTORS.MOVE_BUTTON);
      const closeButton = DOMUtils.getElement(SELECTORS.CLOSE_BUTTON);
      const fullscreenButton = DOMUtils.getElement(SELECTORS.FULLSCREEN_BUTTON);

      if (activeTab) {
        moveButton.disabled = false;
        closeButton.disabled = false;
        fullscreenButton.disabled = false;
        Logger.info(`PopupManager: Aba ativa do YouTube: ${activeTab.title}`);
      } else {
        moveButton.disabled = true;
        closeButton.disabled = true;
        fullscreenButton.disabled = true;
        Logger.warn('PopupManager: Nenhuma aba ativa do YouTube encontrada.');
      }
    },

    /**
     * Manipula o clique no botão "Mover".
     */
    async handleMoveButton() {
      const activeTab = await TabUtils.getActiveYouTubeTab();
      if (!activeTab) {
        DOMUtils.showNotification('Nenhuma aba ativa do YouTube encontrada para mover.', 'error');
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: 'getVideoId' }, async (response) => {
        if (chrome.runtime.lastError) {
          Logger.error(`PopupManager: Erro ao obter vídeo ID: ${chrome.runtime.lastError.message}`);
          DOMUtils.showNotification('Erro ao obter o ID do vídeo. Verifique se a extensão está ativa.', 'error');
          return;
        }

        const videoId = response?.videoId;
        if (!videoId) {
          Logger.warn('PopupManager: Resposta inválida ou sem vídeo ID.');
          DOMUtils.showNotification('Não foi possível obter o ID do vídeo.', 'error');
          return;
        }

        chrome.runtime.sendMessage({ action: 'openFullscreen', videoId, tabId: activeTab.id }, (backgroundResponse) => {
          if (backgroundResponse?.success) {
            Logger.info(`PopupManager: Vídeo "${activeTab.title}" movido para a segunda tela.`);
            DOMUtils.showNotification(`Vídeo "${activeTab.title}" movido para a segunda tela.`, 'success');
          } else {
            Logger.error(`PopupManager: Erro ao mover o vídeo: ${backgroundResponse?.message}`);
            DOMUtils.showNotification(`Erro ao mover o vídeo: ${backgroundResponse?.message}`, 'error');
          }
        });
      });
    },

    /**
     * Manipula o clique no botão "Fechar".
     */
    async handleCloseButton() {
      const activeTab = await TabUtils.getActiveYouTubeTab();
      if (!activeTab) {
        DOMUtils.showNotification('Nenhuma aba ativa do YouTube encontrada para fechar.', 'error');
        return;
      }

      chrome.runtime.sendMessage({ action: 'closeFullscreen', tabId: activeTab.id }, (response) => {
        if (response?.success) {
          Logger.info(`PopupManager: Janela de tela cheia fechada para a aba "${activeTab.title}".`);
          DOMUtils.showNotification(`Janela de tela cheia fechada para a aba "${activeTab.title}".`, 'success');
        } else {
          Logger.error(`PopupManager: Erro ao fechar a janela: ${response?.message}`);
          DOMUtils.showNotification(`Erro ao fechar a janela: ${response?.message}`, 'error');
        }
      });
    },

    /**
     * Manipula o clique no botão "Fullscreen".
     */
    async handleFullscreenButton() {
      const activeTab = await TabUtils.getActiveYouTubeTab();
      if (!activeTab) {
        DOMUtils.showNotification('Nenhuma aba ativa do YouTube encontrada para colocar em fullscreen.', 'error');
        return;
      }

      chrome.runtime.sendMessage({ action: 'requestFullscreen', tabId: activeTab.id }, (response) => {
        if (response?.success) {
          Logger.info(`PopupManager: Aba "${activeTab.title}" colocada em fullscreen.`);
          DOMUtils.showNotification(`Aba "${activeTab.title}" colocada em fullscreen.`, 'success');
        } else {
          Logger.error(`PopupManager: Erro ao colocar em fullscreen: ${response?.message}`);
          DOMUtils.showNotification(`Erro ao colocar em fullscreen: ${response?.message}`, 'error');
        }
      });
    },
  };

  PopupManager.init();
})();
