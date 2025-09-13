import mongoose from "mongoose";

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
export async function runTransaction<T>(
  fn: () => Promise<T>
): Promise<TransactionResult<T>> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await fn();
    await session.commitTransaction();
    session.endSession();
    return { success: true, result };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return { success: false, error };
  }
}
