// stream.helper.ts
import { Readable } from 'stream';

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
    // 1) Already a Node.js Readable
    if (input instanceof Readable) {
      return input;
    }

    // 2) WHATWG/Web-standard ReadableStream (duck-typed via .getReader)
    if (typeof (input as any).getReader === 'function') {
      const web = input as ReadableStream<unknown>;
      
      // Create a manual reader to handle all types properly
      const reader = web.getReader();
      return new Readable({
        async read() {
          try {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null);
              return;
            }

            // Convert the value to Buffer based on its type
            let buffer: Buffer;
            if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
              buffer = Buffer.from(value);
            } else if (typeof value === 'string') {
              buffer = Buffer.from(value);
            } else if (typeof value === 'object' && value !== null) {
              buffer = Buffer.from(JSON.stringify(value));
            } else {
              buffer = Buffer.from(String(value));
            }
            
            this.push(buffer);
          } catch (error) {
            this.destroy(error as Error);
          }
        }
      });
    }

    // 3) Legacy NodeJS.ReadableStream → wrap into a modern Readable
    return new Readable().wrap(input as NodeJS.ReadableStream);
  }
}
