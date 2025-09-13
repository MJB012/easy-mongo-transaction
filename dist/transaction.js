"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTransaction = runTransaction;
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Run a MongoDB transaction using the default mongoose connection.
 * Automatically handles commit/rollback and session cleanup.
 *
 * @param fn Async function containing your DB operations
 * @returns TransactionResult<T>
 */
async function runTransaction(fn) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const result = await fn();
        await session.commitTransaction();
        session.endSession();
        return { success: true, result };
    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        return { success: false, error };
    }
}
