/* Generic logging module.
 *
 * Log Levels:
 * - 3 (Debug)
 * - 2 (Info)
 * - 1 (Warn)
 * - 0 (Error)
 */

class Logger {

    constructor(log_level) {
        this._log_level = log_level ? log_level : 2;
    }

    _timestamp(msg) {
        return (new Date()).toLocaleString().slice(0, 24);
    }

    set(level) {
        this._log_level = level;
    }

    debug(msg) {
        if (this._log_level < 3) {
            return;
        }
        console.info("[" + this._timestamp() + "] DEBUG: " + msg);
    }

    isDebug(msg) {
        if (this._log_level < 3) {
            return false;
        }
        else {
            return true;
        }
    }

    info(msg) {
        if (this._log_level < 2) {
            return;
        }
        console.info("[" + this._timestamp() + "] INFO: " + msg);
    }

    warn(msg) {
        if (this._log_level < 1) {
            return;
        }
        console.warn("[" + this._timestamp() + "] WARN: " + msg);
    }

    error(msg) {
        if (this._log_level < 0) {
            return;
        }
        console.error("[" + this._timestamp() + "] ERROR: " + msg);
    }
}

let instance = new Logger();

exports.Logger = instance;
