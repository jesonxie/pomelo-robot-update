/**
 * stat  receive agent client monitor data
 * merger vaild data that has response
 * when server  restart, it will clear
 *
 *
 */

let _ = require('underscore');

let instance = null;

class Stat {

    constructor() {
        this._timeDataMap = {};
        this._countDataMap = {};
        this.incrData = {};
    }

    /**
     * 单例
     * @return {Stat}
     */
    static getInstance() {
        if (!instance) {
            instance = new Stat();
        }
        return instance;
    }

    getTimeData() {
        return this._timeDataMap;
    }

    getCountData() {
        return this._countDataMap;
    }

    /**
     * clear data
     */
    clear(agent) {
        if (!!agent) {
            delete this._timeDataMap[agent];
            delete this._countDataMap[agent];
        }
        else {
            this._timeDataMap = {};
            this._countDataMap = {};
        }
    }

    merge(agent, message) {
        this._timeDataMap[agent] = message.timeData;
        this._countDataMap[agent] = message.incrData;
    }

}

module.exports = Stat;