export interface TransactionResult<T> {
    success: boolean;
    result?: T;
    error?: any;
}
export declare function runTransaction<T>(fn: () => Promise<T>): Promise<TransactionResult<T>>;
