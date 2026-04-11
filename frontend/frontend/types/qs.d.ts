declare module "qs" {
  export interface IStringifyOptions {
    encode?: boolean;
  }

  export function stringify(obj: unknown, options?: IStringifyOptions): string;

  const qs: {
    stringify: typeof stringify;
  };

  export default qs;
}
