import type { InitializeParams } from '@cerebrate/core/protocol';

type ClientSupport = 'supported' | 'unknown';

export const detectToolListChangeSupport = (params: InitializeParams): ClientSupport => {
  const { clientInfo, capabilities, protocolVersion } = params;

  const knownSupportedClients = ['claude-desktop', 'continue', 'zed'];

  if (clientInfo?.name && knownSupportedClients.includes(clientInfo.name)) {
    return 'supported';
  }

  if (capabilities?.experimental?.['toolListChanged'] === true) {
    return 'supported';
  }

  if (protocolVersion >= '2024-11-05') {
    return 'unknown';
  }

  return 'unknown';
};
