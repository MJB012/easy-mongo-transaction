"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTransaction = runTransaction;
const mongoose_1 = __importDefault(require("mongoose"));
const async_hooks_1 = require("async_hooks");
/* Keep track of the session per async context */
const sessionStorage = new async_hooks_1.AsyncLocalStorage();
/* Patch once to inject sessions automatically */
let patched = false;
function patchMongoose() {
    if (patched)
        return;
    patched = true;
    const exec = mongoose_1.default.Query.prototype.exec;
    mongoose_1.default.Query.prototype.exec = function patchedExec(...args) {
        const session = sessionStorage.getStore();
        if (session && !this.getOptions().session) {
            this.setOptions({ session });
        }
        /* Cast to any so TS stops complaining */
        return exec.apply(this, args);
    };
    const save = mongoose_1.default.Model.prototype.save;
    mongoose_1.default.Model.prototype.save = function patchedSave(...args) {
        const session = sessionStorage.getStore();
        if (session && !this.$session()) {
            this.$session(session);
        }
        /* Cast to any so TS stops complaining */
        return save.apply(this, args);
    };
}
/* Run transaction wrapper */
async function runTransaction(fn) {
    patchMongoose();
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    return sessionStorage.run(session, async () => {
        try {
            const result = await fn();
            await session.commitTransaction();
            return { success: true, result };
        }
        catch (error) {
            await session.abortTransaction();
            return { success: false, error };
        }
        finally {
            session.endSession();
        }
    });
}
