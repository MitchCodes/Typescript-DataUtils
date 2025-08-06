// stream.helper.ts
import { Readable, Transform } from 'stream';

/**
 * Type union of all supported stream types.
 * - Native Node.js Readable streams
 * - Legacy NodeJS.ReadableStream (pre-Streams2 event emitters)
 * - WHATWG/Web-standard ReadableStream
 */
export type AnyReadable =
  | Readable
  | NodeJS.ReadableStream
  | ReadableStream<unknown>;

/**
 * Helper class for converting various stream flavors into a Node.js Readable.
 */
export class StreamHelper {
  /**
   * Normalize any supported stream into a Node.js `stream.Readable` instance.
   * 
   * @param input - The source stream, which may be:
   *   1. A modern Node.js `Readable` (returned through as-is).
   *   2. A WHATWG/Web-standard `ReadableStream<T>` (converted with `Readable.fromWeb`).
   *   3. A legacy `NodeJS.ReadableStream` that only emits `data`/`end` (wrapped).
   * @returns A fully-functional Node.js `stream.Readable` that you can pipe, async-iterate,
   *   etc., regardless of the original stream type.
   */
  public static toNodeReadable(input: AnyReadable): Readable {
    // 1) Already a Node.js Readable ✔️
    if (input instanceof Readable) {
      return input;
    }

    // 2) WHATWG/Web-standard ReadableStream (duck-typed via .getReader)
    if (typeof (input as any).getReader === 'function') {
      const web = input as ReadableStream<unknown>;
      // First, treat it as byte-y and convert
      let node = Readable.fromWeb(web as ReadableStream<Uint8Array>);

      // If the chunks might not be Uint8Array, decode them to Buffer
      // by piping through a simple Transform.
      const decoder = new Transform({
        transform(chunk, _, cb) {
          const buf = Buffer.from(
            typeof chunk === 'string'
              ? chunk
              : typeof chunk === 'object'
              ? JSON.stringify(chunk)
              : chunk
          );
          cb(null, buf);
        }
      });

      return node.pipe(decoder);
    }

    // 3) Legacy NodeJS.ReadableStream → wrap into a modern Readable
    return new Readable().wrap(input as NodeJS.ReadableStream);
  }
}
