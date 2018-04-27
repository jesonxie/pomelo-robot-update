/**
 *
 * agent monitor data map
 *
 * every agent put start and end time in to route map
 * then report to master
 *
 */
let fs = require('fs');
let util = require('../common/util');

let instance = null;

class Monitor {

    constructor() {
        this.dataMap = {};
        this.incrMap = {};
        this.profData = {};
    }

    /**
     * 单例
     * @return {Monitor}
     */
    static getInstance() {
        if (!instance) {
            instance = new Monitor();
        }
        return instance;
    }

    static buildMapData() {
        return {};
    }

    getData() {
        return {
            timeData: this.profData,
            incrData: this.incrMap
        };
    }

    clear() {
        this.profData = {};
        this.incrMap = {};
    }

    incr(name) {
        this.incrMap[name] = !this.incrMap[name] ? 1 : this.incrMap[name] + 1;
        console.log(this.incrMap[name] + ' ' + name);
    }

    decr(name) {
        this.incrMap[name] = !this.incrMap[name] ? 0 : this.incrMap[name] - 1;
    }

    beginTime(route, uid, id) {
        let time = Date.now();
        if (!this.dataMap[route]) {
            this.dataMap[route] = Monitor.buildMapData();
        }
        if (!this.dataMap[route][uid]) {
            this.dataMap[route][uid] = Monitor.buildMapData();
            this.dataMap[route][uid][id] = time;
        }
        this.dataMap[route][uid][id] = time;
    }

    endTime(route, uid, id) {
        if (!this.dataMap[route]) {
            return;
        }
        if (!this.dataMap[route][uid]) {
            return;
        }
        if (!this.dataMap[route][uid][id]) {
            return;
        }
        let beginTime = this.dataMap[route][uid][id];
        delete this.dataMap[route][uid][id];
        let span = Date.now() - beginTime;
        // console.log('route span ' + route+ ' ' + uid + ' ' +  span);
        // this.saveTimes(uid,route+":"+span+'\r\n');
        let srcData = this.profData[route];
        if (!srcData) {
            srcData = {min: span, max: span, avg: span, num: 1};
            this.profData[route] = srcData;
        } else {
            if (span < srcData.min) {
                srcData.min = span;
            }
            if (span > srcData.max) {
                srcData.max = span;
            }
            srcData.avg = (srcData.avg * srcData.num + span) / (srcData.num + 1);
            srcData.num = (srcData.num + 1);
        }
    }

    saveTimes(uid, value) {
        fs.appendFile(util.getPath() + '/detail', value, function (err) {
            if (err) {
                console.log(err);
            }
        });
    }
}

module.exports = Monitor;