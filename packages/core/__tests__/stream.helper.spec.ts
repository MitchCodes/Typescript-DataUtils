import { StreamHelper, AnyReadable } from '../src/logic/helpers/stream.helper';
import { Readable } from 'stream';

/**
 * Utility to collect all Buffer chunks from a Readable into a single Buffer array.
 */
async function collect(stream: Readable): Promise<Buffer[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return chunks;
}

describe('StreamHelper.toNodeReadable()', () => {
  it('passes through native Node.js Readable unchanged', () => {
    const original = Readable.from(['a', 'b', 'c'], { objectMode: true });
    const result = StreamHelper.toNodeReadable(original);
    expect(result).toBe(original);
  });

  it('wraps a legacy NodeJS.ReadableStream with .wrap()', async () => {
    // Fake legacy by emitting data/end on an EventEmitter
    const legacy = new (require('events').EventEmitter)() as NodeJS.ReadableStream;
    process.nextTick(() => {
      legacy.emit('data', Buffer.from('hello'));
      legacy.emit('end');
    });

    const nodeReadable = StreamHelper.toNodeReadable(legacy);
    const data = await collect(nodeReadable as Readable);
    expect(Buffer.concat(data).toString()).toBe('hello');
  });

  it('converts a WHATWG ReadableStream<Uint8Array> correctly', async () => {
    const webUint8 = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(new Uint8Array([1, 2, 3]));
        ctrl.close();
      }
    });

    const node = StreamHelper.toNodeReadable(webUint8);
    const data = await collect(node);
    expect(data[0]).toEqual(Buffer.from([1, 2, 3]));
  });

  it('decodes a WHATWG ReadableStream<string> into Buffer', async () => {
    const webStr = new ReadableStream<string>({
      start(ctrl) {
        ctrl.enqueue('foo');
        ctrl.close();
      }
    });

    const node = StreamHelper.toNodeReadable(webStr as AnyReadable);
    const data = await collect(node);
    expect(data[0].toString()).toBe('foo');
  });

  it('stringifies objects from a WHATWG ReadableStream<object>', async () => {
    const obj = { x: 42 };
    const webObj = new ReadableStream<object>({
      start(ctrl) {
        ctrl.enqueue(obj);
        ctrl.close();
      }
    });

    const node = StreamHelper.toNodeReadable(webObj as AnyReadable);
    const data = await collect(node);
    expect(data[0].toString()).toBe(JSON.stringify(obj));
  });
});
