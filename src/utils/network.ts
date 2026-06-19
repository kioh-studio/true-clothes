import NetInfo from '@react-native-community/netinfo';

export class OfflineError extends Error {
  constructor() {
    super('No internet connection');
    this.name = 'OfflineError';
  }
}

export async function requireOnline(): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false) throw new OfflineError();
}
