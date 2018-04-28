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
        /**
         * 记录所有请求的数据
         * 格式为：
         *      {route1:
         *              { uid1:  {id1: beginTime, id2: beginTime, ...},
         *                uid2:  {id1: beginTime, id2: beginTime, ...},
         *                ...
         *              } ,
         *       ...}
         */
        this.dataMap = {};

        /**
         * 记录所有请求的次数
         * 格式为：
         *      { name1 :number,
         *        name2 :number,
         *        ...
         *      }
         */
        this.incrMap = {};

        /**
         * web 页面展示的数据. prof 即 perform
         * 格式为：
         *      {route1: {min: takeTime, max: takeTime, avg: takeTime, num: requestTimes} ,
         *       ...
         *      }
         */
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

    /**
     * 将该 name 记录请求的次数 加一
     * @param name
     */
    incr(name) {
        this.incrMap[name] = !this.incrMap[name] ? 1 : this.incrMap[name] + 1;
        console.log(this.incrMap[name] + ' ' + name);
    }

    /**
     * 将该 name 记录请求的次数 减一
     * @param name
     */
    decr(name) {
        this.incrMap[name] = !this.incrMap[name] ? 0 : this.incrMap[name] - 1;
    }

    /**
     * 记录请求的开始时间
     * @param route 请求的名字
     * @param uid   发起本次请求的用户id
     * @param id    请求的id
     */
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

    /**
     * 记录请求的结束时间
     * @param route 请求的名字
     * @param uid   发起本次请求的用户id
     * @param id    请求的id
     */
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
        }
        else {
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