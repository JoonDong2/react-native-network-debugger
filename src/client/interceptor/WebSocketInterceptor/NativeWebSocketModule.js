import { TurboModuleRegistry } from 'react-native';

const NativeWebSocketModule = TurboModuleRegistry.getEnforcing('WebSocketModule');

export default NativeWebSocketModule;