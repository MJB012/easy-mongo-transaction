import mongoose, { ClientSession } from "mongoose";
import { AsyncLocalStorage } from "async_hooks";

export interface TransactionResult<T> {
  success: boolean;
  result?: T;
  error?: any;
}

/* Keep track of the session per async context */
const sessionStorage = new AsyncLocalStorage<ClientSession>();

/* Patch once to inject sessions automatically */
let patched = false;
function patchMongoose() {
  if (patched) return;
  patched = true;

  const exec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = function patchedExec(...args: any[]) {
    const session = sessionStorage.getStore();
    if (session && !this.getOptions().session) {
      this.setOptions({ session });
    }
    /* Cast to any so TS stops complaining */
    return (exec as any).apply(this, args);
  };

  const save = mongoose.Model.prototype.save;
  mongoose.Model.prototype.save = function patchedSave(...args: any[]) {
    const session = sessionStorage.getStore();
    if (session && !this.$session()) {
      this.$session(session);
    }
    /* Cast to any so TS stops complaining */
    return (save as any).apply(this, args);
  };
}

/* Run transaction wrapper */
export async function runTransaction<T>(
  fn: () => Promise<T>
): Promise<TransactionResult<T>> {
  patchMongoose();

  const session = await mongoose.startSession();
  session.startTransaction();

  return sessionStorage.run(session, async () => {
    try {
      const result = await fn();
      await session.commitTransaction();
      return { success: true, result };
    } catch (error) {
      await session.abortTransaction();
      return { success: false, error };
    } finally {
      session.endSession();
    }
  });
}
