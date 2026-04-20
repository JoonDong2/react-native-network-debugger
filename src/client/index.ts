import 'react-native/Libraries/Core/InitializeCore.js';
import DebuggerConnection from './DebuggerConnection';
import './cdp/WebSockettoCDPManager';
import { installXHRCDPManager } from './cdp/XHRtoCDPManager';

// RN 버전과 무관하게 HTTP/WS CDP 이벤트를 라이브러리에서 직접 발행한다.
// 네이티브 NetworkHandler(0.83+)가 발행하는 Network.* 이벤트는 서버 측
// InspectorMessageHandler의 Network 도메인이 모두 차단해 중복을 막는다.
installXHRCDPManager();

DebuggerConnection.connect();
