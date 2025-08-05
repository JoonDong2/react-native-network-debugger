import { NativeModules } from 'react-native';

export const getHost = () => {
    const scriptURL = NativeModules.SourceCode.getConstants().scriptURL;
    const regex = /:\/\/([^/:]+):(\d+)/;
    const match = scriptURL.match(regex);
    const [, host, port] = match;
    return { host, port };
}