let io = require('socket.io');
let __ = require('underscore');
let _nodeclient = require('./nodeclient.js');
let _wc = require('./webclient.js');
let logging = require('../common/logging').Logger;
let Stat = require('../monitor/stat');
let starter = require('./starter');

let STATUS_INTERVAL = 60 * 1000; // 60 seconds
let HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
let STATUS_IDLE = 0;
let STATUS_READY = 1;
let STATUS_RUNNING = 2;
let STATUS_DISCONN = 3;

class Server {

    /**
     *
     * robot master instance
     *
     * @param {Object} conf
     *
     * conf.main client run file
     */
    constructor(conf) {
        this.log = logging;
        this.nodes = {};
        this.web_clients = {};
        this.conf = conf || {};
        this.runconfig = null;
        this.status = STATUS_IDLE;

        setInterval(() => {
            this.log.info("Nodes: " + __(this.nodes).size() + ", " +
                "WebClients: " + __(this.web_clients).size());
        }, STATUS_INTERVAL);
    }

    listen(port) {
        this.io = io.listen(port);
        this.register();
    }

    // Registers new Node with Server, announces to WebClients
    announce_node(socket, message) {
        this.log.info(` ------------- server announce_node, message:${message}`);

        let nodeId = message.nodeId;

        if (!!this.nodes[nodeId]) {
            this.log.warn("Warning: Node '" + nodeId + "' already exists, delete old items ");
            socket.emit('node_already_exists');
            delete this.nodes[nodeId];
        }

        console.log(`announce_node socket:` ,socket);
        let node = new _nodeclient.NodeClient(nodeId, socket, this);
        this.nodes[nodeId] = node;

        __(this.web_clients).each((web_client) => {
            web_client.add_node(node);
        });

        socket.on('disconnect', () => {
            delete this.nodes[nodeId];
            __(this.web_clients).each((web_client) => {
                web_client.remove_node(node);
            });
            if (__.size(this.nodes) <= 0) {
                this.status = STATUS_IDLE;
            }
            Stat.getInstance().clear(nodeId);
        });

        socket.on('report', (message) => {
            Stat.getInstance().merge(nodeId, message);
        });

        /* temporary code */
        socket.on('error', (message) => {
            __(this.web_clients).each((web_client) => {
                web_client.error_node(node, message);
            });
        });

        socket.on('crash', (message) => {
            __(this.web_clients).each((web_client) => {
                web_client.error_node(node, message);
            });
            this.status = STATUS_READY;
        });
        /* temporary code */

    }

    // Registers new WebClient with Server
    announce_web_client(socket) {
        this.log.info(` ------------- server announce_web_client`);

        let web_client = new _wc.WebClient(socket, this);
        this.web_clients[web_client.id] = web_client;

        __(this.nodes).each((node, nlabel) => {
            web_client.add_node(node);
        });

        setInterval(() => {
            this.io.sockets.in('web_clients').emit('statusreport', {status: this.status});
        }, STATUS_INTERVAL / 10);

        socket.on('webreport', (message) => {
            if (this.status === STATUS_RUNNING) {
                socket.emit('webreport', this.runconfig.agent, this.runconfig.maxuser, Stat.getInstance().getTimeData(this), Stat.getInstance().getCountData());
            }
        });

        socket.on('detailreport', (message) => {
            if (this.status === STATUS_RUNNING) {
                socket.emit('detailreport', Stat.getInstance().getDetails());
            }
        });

        socket.on('disconnect', () => {
            delete this.web_clients[web_client.id];
        });
    }

    // Register announcement, disconnect callbacks
    register() {
        this.io.set('log level', 1);

        this.io.sockets.on('connection', (socket) => {

            socket.on('announce_node', (message) => {
                this.log.info("Registering new node " + JSON.stringify(message));
                this.announce_node(socket, message);
            });

            socket.on('announce_web_client', (message) => {
                this.log.info("Registering new web_client");
                this.announce_web_client(socket);

                socket.on('run', (msg) => {
                    Stat.getInstance().clear();
                    msg.agent = __.size(this.nodes);
                    console.log('server begin notify client to run machine...');
                    this.runconfig = msg;
                    let i = 0;
                    __.each(this.nodes, (ele) => {
                        //console.log(i++);
                        msg.index = i++;
                        ele.socket.emit('run', msg);
                    });
                    //this.io.sockets.in('nodes').emit('run',msg);
                    this.status = STATUS_RUNNING;
                });

                socket.on('ready', (msg) => {
                    console.log('server begin ready client ...');
                    this.io.sockets.in('nodes').emit('disconnect', {});
                    Stat.getInstance().clear();
                    this.status = STATUS_READY;
                    this.runconfig = msg;
                    starter.run(this.conf.mainFile, msg, this.conf.clients);
                });

                socket.on('exit4reready', () => {
                    __.each(this.nodes, (obj) => {
                        obj.socket.emit('exit4reready');
                    });
                    this.nodes = {};
                });

            });
        });

        // Broadcast heartbeat to all clients
        setInterval(() => {
            this.io.sockets.emit('heartbeat');
        }, HEARTBEAT_INTERVAL);
    }
}


exports.Server = Server;
