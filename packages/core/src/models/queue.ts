export class Queue<T> {
    private _store: T[] = [];

    public push(val: T) {
        this._store.push(val);
    }

    public pop(): T | undefined {
        return this._store.shift();
    }

    public length(): number {
        return this._store.length;
    }
}
