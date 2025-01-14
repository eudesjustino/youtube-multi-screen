(() => {
  const SELECTORS = {
    PLAYER_CONTAINER: '#player-container',
    PLAYER_IFRAME: '#player',
  };

  const URL_PARAMS = {
    VIDEO_ID: 'videoId',
  };

  const Logger = {
    info: (message, ...args) => console.log(`INFO: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`WARN: ${message}`, ...args),
    error: (message, ...args) => console.error(`ERROR: ${message}`, ...args),
  };

  const DOMUtils = {
    getQueryParam(param) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param);
    },
    getElement(selector) {
      return document.querySelector(selector);
    },
  };

  const FullscreenManager = {
    init() {
      document.addEventListener('DOMContentLoaded', this.handleDOMContentLoaded.bind(this));

      if (typeof chrome.runtime !== 'undefined' && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
      }
    },

    handleDOMContentLoaded() {
      Logger.info('Fullscreen: DOMContentLoaded iniciado.');
      const videoId = DOMUtils.getQueryParam(URL_PARAMS.VIDEO_ID);

      if (!this.isValidVideoId(videoId)) {
        Logger.error('Fullscreen: videoId inválido ou ausente.');
        alert('Nenhum vídeo válido especificado.');
        return;
      }

      Logger.info(`Fullscreen: videoId obtido: ${videoId}`);
      this.loadVideo(videoId);
    },

    loadVideo(videoId) {
      const iframe = DOMUtils.getElement(SELECTORS.PLAYER_IFRAME);
      if (!iframe) {
        Logger.error(`Fullscreen: Iframe com seletor ${SELECTORS.PLAYER_IFRAME} não encontrado.`);
        return;
      }

      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&fs=1`;
      Logger.info('Fullscreen: Iframe atualizado com a URL do vídeo.');
    },

    requestFullscreen() {
      const elem = DOMUtils.getElement(SELECTORS.PLAYER_CONTAINER);
      if (!elem) {
        Logger.error(`Fullscreen: Elemento com seletor ${SELECTORS.PLAYER_CONTAINER} não encontrado.`);
        return;
      }

      if (!document.fullscreenElement) {
        elem.requestFullscreen().then(() => {
          Logger.info('Fullscreen: Tela cheia solicitada com sucesso.');
        }).catch(err => {
          Logger.error('Fullscreen: Erro ao entrar em tela cheia:', err);
        });
      } else {
        Logger.info('Fullscreen: Já está em modo fullscreen.');
      }
    },

    handleMessage(request, sender, sendResponse) {
      Logger.info(`Fullscreen: Recebeu ação: ${request.action}`);
      if (request.action === 'enterFullscreen') {
        this.requestFullscreen();
        sendResponse({ status: 'Fullscreen solicitado com sucesso.' });
        return true;
      }
      Logger.warn(`Fullscreen: Ação desconhecida recebida: ${request.action}`);
      return false;
    },

    isValidVideoId(videoId) {
      const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;
      return videoIdPattern.test(videoId);
    },
  };

  FullscreenManager.init();
})();
