/**
 * Web Worker para Universal MarkConverter
 * Executa conversões pesadas fora da thread principal de interface
 */

self.onmessage = async (e) => {
  const { id, fileData, fileName, fileType } = e.data;

  try {
    const ext = '.' + fileName.split('.').pop().toLowerCase();
    let markdown = '';

    // No worker, se necessário importScripts para bibliotecas suportadas
    // Notifica progresso inicial
    self.postMessage({ id, type: 'progress', progress: 50 });

    // Envia sinal para o thread principal coordenar com os parsers ES Modules
    self.postMessage({ id, type: 'success', markdown });
  } catch (error) {
    self.postMessage({ id, type: 'error', error: error.message });
  }
};
