// content.js

(() => {
  // Constantes
  const ACTIONS = {
    GET_VIDEO_ID: 'getVideoId',
    ENTER_FULLSCREEN: 'enterFullscreen',
  };

  // Logger personalizado para facilitar o rastreamento
  const Logger = {
    info: (message, ...args) => console.log(`INFO: ${message}`, ...args),
    warn: (message, ...args) => console.warn(`WARN: ${message}`, ...args),
    error: (message, ...args) => console.error(`ERROR: ${message}`, ...args),
  };

  /**
   * Inicializa o Content Script.
   */
  const init = () => {
    Logger.info('Content Script: Injetado na aba do YouTube.');

    chrome.runtime.onMessage.addListener(handleMessage);
  };

  /**
   * Manipulador de mensagens recebidas.
   * @param {Object} request - A mensagem recebida.
   * @param {Object} sender - Informações sobre o remetente.
   * @param {Function} sendResponse - Função para enviar uma resposta.
   * @returns {boolean} - Indica que sendResponse será chamado de forma assíncrona.
   */
  const handleMessage = (request, sender, sendResponse) => {
    Logger.info(`Content Script: Recebeu ação: ${request.action}`);

    switch (request.action) {
      case ACTIONS.GET_VIDEO_ID:
        handleGetVideoId(sendResponse);
        break;
      case ACTIONS.ENTER_FULLSCREEN:
        handleEnterFullscreen(sendResponse);
        break;
      default:
        Logger.warn(`Content Script: Ação desconhecida recebida: ${request.action}`);
    }

    // Retorna true para indicar que sendResponse será chamado de forma assíncrona
    return true;
  };

  /**
   * Lida com a ação de obter o ID do vídeo.
   * @param {Function} sendResponse - Função para enviar uma resposta.
   */
  const handleGetVideoId = (sendResponse) => {
    try {
      const videoId = extractVideoId();
      if (videoId) {
        Logger.info(`Content Script: videoId encontrado: ${videoId}`);
        sendResponse({ videoId });
      } else {
        Logger.warn('Content Script: videoId não encontrado.');
        sendResponse({ videoId: null });
      }
    } catch (error) {
      Logger.error('Content Script: Erro ao extrair videoId:', error);
      sendResponse({ videoId: null, error: error.message });
    }
  };

  /**
   * Lida com a ação de entrar no modo fullscreen.
   * @param {Function} sendResponse - Função para enviar uma resposta.
   */
  const handleEnterFullscreen = async (sendResponse) => {
    try {
      await enterFullscreenMode();
      Logger.info('Content Script: Entrou em modo fullscreen com sucesso.');
      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Content Script: Erro ao entrar em fullscreen:', error);
      sendResponse({ success: false, message: error.message });
    }
  };

  /**
   * Extrai o ID do vídeo da URL atual.
   * @returns {string|null} - O ID do vídeo ou null se não encontrado.
   */
  const extractVideoId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  };

  /**
   * Solicita que o documento entre no modo fullscreen.
   * @returns {Promise<void>}
   */
  const enterFullscreenMode = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        throw new Error(`Falha ao entrar em fullscreen: ${error.message}`);
      }
    }
  };

  // Inicializa o Content Script
  init();
})();
