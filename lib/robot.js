let Agent = require('./agent/agent').Agent;
let Server = require('./master/server').Server;
let HTTP_SERVER = require('./console/http').HTTP_SERVER;
let util = require('./common/util').createPath();

class Robot {

    /**
     * export to developer prototype
     *
     * @param {Object} config
     * include deal with master and agent mode
     *
     * param include mode
     *
     */
    constructor(config) {
        this.conf = config;
        this.master = null;
        this.agent = null;
    }

    /**
     * run master server
     * @param mainFile {String} start up file
     */
    runMaster(mainFile) {
        let conf = {}, master;
        conf.clients = this.conf.clients;
        conf.mainFile = mainFile;
        this.master = new Server(conf);
        this.master.listen(this.conf.master.port);
        HTTP_SERVER.start(this.conf.master.webport);
    }

    /**
     * run agent client
     * @param script {String}
     */
    runAgent(script) {
        let conf = {};
        conf.master = this.conf.master;
        conf.apps = this.conf.apps;
        conf.scriptFile = script;
        this.agent = new Agent(conf);
        this.agent.start();
    }

    restart() {
        if (this.agent) {
            this.agent.reconnect(true);
        }
    }

}

exports.Robot = Robot;

