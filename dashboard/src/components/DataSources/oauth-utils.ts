export const generateState = () => {
  return Math.random().toString(36).substring(2);
};

export const openOAuthWindow = async (authUrl: string): Promise<{ code: string; state: string }> => {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const oauthWindow = window.open(
      authUrl,
      'OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!oauthWindow) {
      reject(new Error('Failed to open OAuth window'));
      return;
    }

    const checkClosed = setInterval(() => {
      if (oauthWindow.closed) {
        clearInterval(checkClosed);
        reject(new Error('OAuth window was closed'));
      }
    }, 1000);

    window.addEventListener('message', function handler(event) {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'oauth-callback') {
        clearInterval(checkClosed);
        window.removeEventListener('message', handler);
        oauthWindow.close();
        resolve(event.data);
      }
    });
  });
}; 