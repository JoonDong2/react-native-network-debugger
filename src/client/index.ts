import 'react-native/Libraries/Core/InitializeCore.js';
import DebuggerConnection from './DebuggerConnection';
import './cdp/XHRtoCDPManager';
import './cdp/WebSockettoCDPManager';

DebuggerConnection.connect();
