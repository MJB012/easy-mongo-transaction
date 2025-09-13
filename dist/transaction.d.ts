export interface TransactionResult<T> {
    success: boolean;
    result?: T;
    error?: any;
}
/**
 * Run a MongoDB transaction using the default mongoose connection.
 * Automatically handles commit/rollback and session cleanup.
 *
 * @param fn Async function containing your DB operations
 * @returns TransactionResult<T>
 */
export declare function runTransaction<T>(fn: () => Promise<T>): Promise<TransactionResult<T>>;
