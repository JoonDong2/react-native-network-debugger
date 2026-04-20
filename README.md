# react-native-network-debugger

This package enables the **Network panel** in React Native DevTools by intercepting JavaScript's `XMLHttpRequest` and `WebSocket` traffic and forwarding it to the panel for debugging.

## Features

- **XHR / Fetch** — request/response headers, body, status
- **WebSocket** — connection handshake, sent/received frames, close events
- **WS filter button** — a dedicated "WS" filter tab appears in the Network panel to isolate WebSocket traffic (requires React Native 0.83+)
- **RN 0.83+ compatible** — automatically patches the bundled debugger-frontend at runtime to enable the WS filter

## Installation

### 1. Add the package as a development dependency.

```bash
yarn add -D react-native-network-debugger
```

### 2. Add the command to your react-native.config.js file.
```js
module.exports = {
  // ...
  commands: [require('react-native-network-debugger')],
};
```

### 3. Start your Metro server.
```bash
yarn start
```

### 4. (Optional) Add a resolution to package.json.
If you encounter issues with multiple versions of react-native or its dependencies, add a resolution to ensure a single version is used.
```json
{
  "resolutions": {
    "@react-native/dev-middleware": "<your main react-native version>"
  }
}
```

## Usage

Open **React Native DevTools** and navigate to the **Network** tab. All XHR/Fetch requests appear automatically. On React Native 0.83+, a **WS** filter button is injected into the panel to show only WebSocket connections.
