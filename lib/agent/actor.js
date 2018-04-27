let util = require('util');
let EventEmitter = require('events').EventEmitter;
let fs = require('fs');
let vm = require('vm');
let Monitor = require('../monitor/monitor');
let envConfig = require(process.cwd() + '/app/config/env.json');
let script = fs.readFileSync(process.cwd() + envConfig.script, 'utf8');

class Actor extends EventEmitter {

    constructor(conf, aid) {
        super();

        EventEmitter.call(this);
        this.id = aid;
        this.script = conf.script || script;

        this.on('start', (action, reqId) => {
            Monitor.getInstance().beginTime(action, this.id, reqId);
        });

        this.on('end', (action, reqId) => {
            Monitor.getInstance().endTime(action, this.id, reqId);
        });

        this.on('incr', (action) => {
            Monitor.getInstance().incr(action);
        });

        this.on('decr', (action) => {
            Monitor.getInstance().decr(action);
        });
    }

    run() {
        try {
            let initSandbox = {
                console: console,
                require: require,
                actor: this,
                setTimeout: setTimeout,
                clearTimeout: clearTimeout,
                setInterval: setInterval,
                clearInterval: clearInterval,
                global: global,
                process: process
            };

            let context = vm.createContext(initSandbox);
            vm.runInContext(script, context);

        } catch (ex) {
            this.emit('error', ex.stack);
        }
    }

    /**
     * clear data
     *
     */
    reset() {
        Monitor.getInstance().clear();
    }

    /**
     * wrap setTimeout
     *
     *@param {Function} fn
     *@param {Number} time
     */
    later(fn, time) {
        if (time > 0 && typeof(fn) === 'function') {
            return setTimeout(fn, time);
        }
    }

    /**
     * wrap setInterval
     * when time is Array, the interval time is thd random number
     * between then
     *
     *@param {Function} fn
     *@param {Number} time
     */
    interval(fn, time) {
        switch (typeof(time)) {
            case 'number':
                if (arguments[1] > 0) {
                    return setInterval(fn, arguments[1]);
                }
                break;

            case 'object':
                let start = time[0], end = time[1];
                let time = Math.round(Math.random() * (end - start) + start);
                return setTimeout(() => {
                    fn();
                    this.interval(fn, time);
                }, time);
                break;

            default:
                this.log.error('wrong argument');
                return;
        }
    }

    /**
     *wrap clearTimeout
     *
     * @param {Number} timerId
     *
     */
    clean(timerId) {
        clearTimeout(timerId);
    }

    /**
     *encode message
     *
     * @param {Number} id
     * @param {Object} msg
     *
     */
}


exports.Actor = Actor;
