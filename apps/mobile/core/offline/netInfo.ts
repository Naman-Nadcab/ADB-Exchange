import NetInfo from '@react-native-community/netinfo';

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

let cached: NetworkState = { isConnected: true, isInternetReachable: true };

export async function initNetworkMonitor(onChange: (s: NetworkState) => void) {
  const state = await NetInfo.fetch();
  cached = {
    isConnected: !!state.isConnected,
    isInternetReachable: state.isInternetReachable,
  };
  onChange(cached);
  return NetInfo.addEventListener((state) => {
    cached = {
      isConnected: !!state.isConnected,
      isInternetReachable: state.isInternetReachable,
    };
    onChange(cached);
  });
}

export function getNetworkState(): NetworkState {
  return cached;
}

/** One-shot connectivity check without registering a new listener. */
export async function checkNetworkOnce(): Promise<NetworkState> {
  const state = await NetInfo.fetch();
  cached = {
    isConnected: !!state.isConnected,
    isInternetReachable: state.isInternetReachable,
  };
  return cached;
}
