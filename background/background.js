// background.js

// Constantes
const STORAGE_KEY = 'fullscreenWindowId';
const CHECK_INTERVAL = 30000; // 30 segundos
const FULLSCREEN_URL = 'fullscreen/fullscreen.html';
const FULLSCREEN_SCRIPT = 'fullscreen/fullscreen.js';

// Logger personalizado para facilitar o rastreamento
const Logger = {
  info: (message, ...args) => console.log(`INFO: ${message}`, ...args),
  warn: (message, ...args) => console.warn(`WARN: ${message}`, ...args),
  error: (message, ...args) => console.error(`ERROR: ${message}`, ...args),
};

// Utilitários de armazenamento
const Storage = {
  getWindowId: async () => {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      Logger.info('Retrieved windowId from storage:', result[STORAGE_KEY]);
      return result[STORAGE_KEY] || null;
    } catch (error) {
      Logger.error('Failed to get windowId from storage:', error);
      return null;
    }
  },

  setWindowId: async (windowId) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: windowId });
      Logger.info(`windowId ${windowId} set in storage.`);
      return true;
    } catch (error) {
      Logger.error('Failed to set windowId in storage:', error);
      return false;
    }
  },

  clearWindowId: async () => {
    try {
      await chrome.storage.local.remove([STORAGE_KEY]);
      Logger.info('windowId removed from storage.');
      return true;
    } catch (error) {
      Logger.error('Failed to remove windowId from storage:', error);
      return false;
    }
  },
};

// Funções principais
const FullscreenManager = {
  async openFullscreenWindow(videoId) {
    const storedWindowId = await Storage.getWindowId();

    if (storedWindowId) {
      try {
        const window = await chrome.windows.get(storedWindowId, { populate: true });
        if (window) {
          Logger.info('Fullscreen window already open. Updating video.');
          await this.updateFullscreenWindow(videoId, storedWindowId);
          return;
        }
      } catch (error) {
        Logger.warn('Stored window does not exist anymore:', error);
        await Storage.clearWindowId();
      }
    }

    const displays = await this.getDisplays();
    const targetDisplay = displays.length > 1 ? displays[1] : displays[0];
    Logger.info(`Selected display ID: ${targetDisplay.id}`);

    const { left, top, width, height } = targetDisplay.bounds;
    Logger.info(`Positioning window - Left: ${left}, Top: ${top}, Width: ${width}, Height: ${height}`);

    try {
      const newWindow = await chrome.windows.create({
        url: `${FULLSCREEN_URL}?videoId=${encodeURIComponent(videoId)}`,
        type: 'popup',
        left,
        top,
        width,
        height,
        focused: true,
      });

      await Storage.setWindowId(newWindow.id);
      Logger.info(`Fullscreen window created with ID: ${newWindow.id}`);

      await this.maximizeWindow(newWindow.id);
      await this.injectFullscreenScript(newWindow.id);
    } catch (error) {
      Logger.error('Failed to create fullscreen window:', error);
    }
  },

  async closeFullscreenWindow(sendResponse) {
    const windowId = await Storage.getWindowId();

    if (!windowId) {
      Logger.warn('No fullscreen window is open to close.');
      sendResponse({ success: false, message: 'Nenhuma janela de tela cheia está aberta.' });
      return;
    }

    try {
      await chrome.windows.remove(windowId);
      Logger.info(`Fullscreen window with ID ${windowId} closed.`);
      await Storage.clearWindowId();
      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Failed to close fullscreen window:', error);
      sendResponse({ success: false, message: error.message });
    }
  },

  async handleVideoChange(videoId) {
    const windowId = await Storage.getWindowId();
    if (windowId && videoId) {
      await this.updateFullscreenWindow(videoId, windowId);
    }
  },

  async triggerFullscreen(sendResponse) {
    const windowId = await Storage.getWindowId();

    if (!windowId) {
      Logger.warn('No fullscreen window is open to trigger fullscreen.');
      sendResponse({ success: false, message: 'Nenhuma janela de tela cheia está aberta.' });
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ windowId });
      if (!tab) throw new Error('No tab found in fullscreen window.');

      await chrome.tabs.sendMessage(tab.id, { action: 'enterFullscreen' });
      Logger.info('Sent enterFullscreen message to fullscreen tab.');
      sendResponse({ success: true });
    } catch (error) {
      Logger.error('Failed to trigger fullscreen:', error);
      sendResponse({ success: false, message: error.message });
    }
  },

  async updateFullscreenWindow(videoId, windowId) {
    try {
      const [tab] = await chrome.tabs.query({ windowId });
      if (!tab) throw new Error('No tab found in fullscreen window.');

      await chrome.tabs.update(tab.id, { url: `${FULLSCREEN_URL}?videoId=${encodeURIComponent(videoId)}` });
      Logger.info('Fullscreen window updated with new videoId.');
    } catch (error) {
      Logger.error('Failed to update fullscreen window:', error);
    }
  },

  async injectFullscreenScript(windowId) {
    try {
      const [tab] = await chrome.tabs.query({ windowId });
      if (!tab) throw new Error('No tab found in fullscreen window.');

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [FULLSCREEN_SCRIPT],
      });
      Logger.info('Injected fullscreen script into window.');
    } catch (error) {
      Logger.error('Failed to inject fullscreen script:', error);
    }
  },

  async maximizeWindow(windowId) {
    try {
      await chrome.windows.update(windowId, { state: 'maximized' });
      Logger.info('Fullscreen window maximized.');
    } catch (error) {
      Logger.error('Failed to maximize window:', error);
    }
  },

  getDisplays() {
    return new Promise((resolve) => {
      chrome.system.display.getInfo((displays) => {
        if (chrome.runtime.lastError) {
          Logger.error('Failed to get display information:', chrome.runtime.lastError);
          resolve([]);
        } else {
          Logger.info('Display information retrieved:', displays);
          resolve(displays);
        }
      });
    });
  },
};

// Listener para mensagens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  Logger.info(`Received action: ${request.action}`);

  switch (request.action) {
    case 'openFullscreen':
      FullscreenManager.openFullscreenWindow(request.videoId);
      break;
    case 'closeFullscreen':
      FullscreenManager.closeFullscreenWindow(sendResponse);
      break;
    case 'videoChanged':
      FullscreenManager.handleVideoChange(request.videoId);
      break;
    case 'requestFullscreen':
      FullscreenManager.triggerFullscreen(sendResponse);
      break;
    default:
      Logger.warn(`Unknown action received: ${request.action}`);
  }

  // Indica que sendResponse será chamado de forma assíncrona
  return true;
});

// Monitorar o fechamento da janela para limpar o storage
chrome.windows.onRemoved.addListener(async (closedWindowId) => {
  const storedWindowId = await Storage.getWindowId();
  if (closedWindowId === storedWindowId) {
    Logger.info(`Fullscreen window with ID ${closedWindowId} was closed.`);
    await Storage.clearWindowId();
  }
});

// // Verificação periódica da existência da janela fullscreen
// setInterval(async () => {
//   const windowId = await Storage.getWindowId();
//   if (windowId) {
//     try {
//       await chrome.windows.get(windowId);
//       Logger.info('Fullscreen window is still open.');
//     } catch (error) {
//       Logger.warn('Fullscreen window no longer exists (periodic check).');
//       await Storage.clearWindowId();
//     }
//   }
// }, CHECK_INTERVAL);
