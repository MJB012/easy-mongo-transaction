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

  /* --- Patch query exec (covers find, findOne, findById, etc.) */
  const exec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = function patchedExec(...args: any[]) {
    const session = sessionStorage.getStore();
    if (session && !this.getOptions().session) {
      this.setOptions({ session });
    }
    return (exec as any).apply(this, args);
  };

  /* --- Patch document.save() */
  const save = mongoose.Model.prototype.save;
  mongoose.Model.prototype.save = function patchedSave(...args: any[]) {
    const session = sessionStorage.getStore();
    if (session && !this.$session()) {
      this.$session(session);
    }
    return (save as any).apply(this, args);
  };

  /* --- Patch document.remove() */
  const remove = mongoose.Model.prototype.remove;
  mongoose.Model.prototype.remove = function patchedRemove(...args: any[]) {
    const session = sessionStorage.getStore();
    if (session && !this.$session()) {
      this.$session(session);
    }
    return (remove as any).apply(this, args);
  };

  /* --- Patch document.deleteOne() */
  const deleteOneDoc = mongoose.Model.prototype.deleteOne;
  mongoose.Model.prototype.deleteOne = function patchedDeleteOneDoc(...args: any[]) {
    const session = sessionStorage.getStore();
    if (session && !this.$session()) {
      this.$session(session);
    }
    return (deleteOneDoc as any).apply(this, args);
  };

  /* --- Patch aggregate() */
  const aggregate = mongoose.Model.aggregate;
  mongoose.Model.aggregate = function patchedAggregate(...args: any[]) {
    const session = sessionStorage.getStore();
    const agg = (aggregate as any).apply(this, args);
    if (session && !agg.options.session) {
      agg.session(session);
    }
    return agg;
  };

  /* --- Patch common static model operations */
  const modelOps = [
    "updateOne",
    "updateMany",
    "replaceOne",
    "deleteOne",
    "deleteMany",
    "findOneAndUpdate",
    "findByIdAndUpdate",
    "findOneAndDelete",
    "findByIdAndDelete",
    "bulkWrite",
  ] as const;

  for (const op of modelOps) {
    const original = (mongoose.Model as any).prototype[op];
    if (!original) continue;

    (mongoose.Model as any).prototype[op] = function patchedOp(
      ...args: any[]
    ) {
      const session = sessionStorage.getStore();
      if (session) {
        const optionsIndex =
          args.length > 0 && typeof args[args.length - 1] === "object"
            ? args.length - 1
            : -1;

        if (optionsIndex >= 0) {
          if (!args[optionsIndex].session) {
            args[optionsIndex].session = session;
          }
        } else {
          args.push({ session });
        }
      }
      return original.apply(this, args);
    };
  }
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
