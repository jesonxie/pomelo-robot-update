const __ = require('underscore');
const fs = require('fs');
const io = require('socket.io-client');

let logging = require('../common/logging').Logger;
let Actor = require('./actor').Actor;
let Monitor = require('../monitor/monitor');
let util = require('../common/util');

const STATUS_INTERVAL = 10 * 1000; // 10 seconds
const RECONNECT_INTERVAL = 10 * 1000; // 15 seconds
const HEARTBEAT_PERIOD = 30 * 1000; // 30 seconds
const HEARTBEAT_FAILS = 3; // Reconnect after 3 missed heartbeats


class Agent {

    /**
     *
     * @param {Object} conf
     * init the master and app server for the agent
     * include app data, exec script,etc.
     */
    constructor(conf) {
        this.log = logging;
        this.conf = conf || {};
        this.last_heartbeat = null;
        this.connected = false;
        this.reconnecting = false;
        this.actors = {};
        this.count = 0;
    }

    // Create socket, bind callbacks, connect to server
    connect() {
        let uri = `http://${this.conf.master.host}:${this.conf.master.port}`;
        this.socket = io(uri, {
            forceNew: true,
            transports: [`websocket`],
        });

        this.socket.on('error', (reason) => {
            this.reconnect();
        });

        // Register announcement callback
        this.socket.on('connect', () => {
            this.log.info("Connected to server, sending announcement...");
            //console.log(this.socket.id);
            //console.log(require('util').inspect(this.socket.address,true,10,10));
            this.announce(this.socket);
            this.connected = true;
            this.reconnecting = false;
            this.last_heartbeat = new Date().getTime();
        });

        this.socket.on('disconnect', () => {
            this.socket.disconnect();
            this.log.error("Disconnect...");
        });

        // Server heartbeat
        this.socket.on('heartbeat', () => {
            //agent.log.info("Received server heartbeat");
            this.last_heartbeat = new Date().getTime();
        });

        // Node with same label already exists on server, kill process
        this.socket.on('node_already_exists', () => {
            this.log.error("ERROR: A node of the same name is already registered");
            this.log.error("with the log server. Change this agent's instance_name.");
            this.log.error("Exiting.");
            process.exit(1);
        });

        //begin to run
        this.socket.on('run', (message) => {
            this.log.info(`Received server run , message:${message}`);
            this.run(message);
        });

        // Exit for BTN_ReReady
        this.socket.on('exit4reready', () => {
            this.log.info("Exit for BTN_ReReady.");
            process.exit(0);
        });
    }

    run(msg) {
        this.log.info(this.nodeId + ' run ' + this.count + ' actors ');
        util.deleteLog();
        this.count = msg.maxuser;
        let script = msg.script;
        let index = msg.index;
        if (!!script && script.length > 1) {
            this.conf.script = script;
        }
        this.log.info(this.nodeId + ' run ' + this.count + ' actors ');
        Monitor.getInstance().clear();
        this.actors = {};
        let offset = index * this.count;
        for (let i = 0; i < this.count; i++) {
            let aid = i + offset; //calc database key offset;
            let actor = new Actor(this.conf, aid);
            this.actors[aid] = actor;
            ((actor) => {
                actor.on('error', (error) => {
                    this.socket.emit('error', error);
                });
                if (this.conf.master.interval <= 0) {
                    actor.run();
                }
                else {
                    let time = Math.round(Math.random() * 1000 + i * this.conf.master.interval);
                    setTimeout(() => {
                        actor.run();
                    }, time);
                }
            })(actor);
        }

        setInterval(() => {
            let mdata = Monitor.getInstance().getData();
            this.socket.emit('report', mdata);
        }, STATUS_INTERVAL);
    }

    // Run agent
    start() {
        this.connect();
        // Check for heartbeat every HEARTBEAT_PERIOD, reconnect if necessary
        setInterval(() => {
            let delta = ((new Date().getTime()) - this.last_heartbeat);
            if (delta > (HEARTBEAT_PERIOD * HEARTBEAT_FAILS)) {
                this.log.warn("Failed heartbeat check, reconnecting...");
                this.connected = false;
                this.reconnect();
            }
        }, HEARTBEAT_PERIOD);
    }

    // Sends announcement
    announce(socket) {
        let sessionid = this.socket.id;
        this.nodeId = sessionid;
        this._send('announce_node', {
            client_type: 'node',
            nodeId: sessionid
        });
    }

    /**
     * Reconnect helper, retry until connection established
     * @param force
     */
    reconnect(force) {
        if (!force && this.reconnecting) {
            return;
        }
        this.reconnecting = true;
        if (this.socket !== null) {
            this.socket.disconnect();
            this.connected = false;
        }
        this.log.info("Reconnecting to server...");
        setTimeout(() => {
            if (this.connected) {
                return;
            }
            this.connect();
        }, RECONNECT_INTERVAL);
    }

    _send(event, message) {
        try {
            this.socket.emit(event, message);
            // If server is down, a non-writeable stream error is thrown.
        } catch (err) {
            this.log.error("ERROR: Unable to send message over socket.");
            this.connected = false;
            this.reconnect();
        }
    }
}

exports.Agent = Agent;
