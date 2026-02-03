import { NativeModules } from 'react-native';

interface HostInfo {
  host: string;
  port: string;
}

export const getHost = (): HostInfo => {
  const scriptURL: string = NativeModules.SourceCode.getConstants().scriptURL;
  const regex = /:\/\/([^/:]+):(\d+)/;
  const match = scriptURL.match(regex);
  const [, host, port] = match!;
  return { host, port };
};
