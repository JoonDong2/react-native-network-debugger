# react-native-network-debugger

This package enables the `network panel` in React Native DevTools by intercepting JavaScript's `XMLHttpRequest` and `WebSocket` data and forwarding it to the panel for debugging.

# Installation

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

### 3. (Optional) Add a resolution to package.json.
If you have mismanaged dependencies, you might have two versions of react-native installed, which can cause issues. This step is not necessary in most cases.
```json
{
  "resolutions": {
    "@react-native/dev-middleware": "<your main react-native version>"
  }
}
```

### 4. Start your Metro server.
```bash
yarn start
```