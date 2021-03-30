export class ErrorHelper {
    public static isError(e: any): boolean {
        return e && e.stack && e.message && typeof e.stack === 'string' 
            && typeof e.message === 'string';
    }
}