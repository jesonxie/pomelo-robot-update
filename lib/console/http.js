// ------------------------------------
// HTTP Server 
// ------------------------------------
//
// This file defines HttpServer and the singleton HTTP_SERVER.
//
// This file defines a generic HTTP server that serves static files and that can be configured
// with new routes. It also starts the nodeload HTTP server unless require('nodeload/config')
// .disableServer() was called.
// 

let http;
let fs;
let util;
let qputs;
let EventEmitter;

let Stat = require('../monitor/stat');
let __ = require('underscore');

let BUILD_AS_SINGLE_FILE;
if (!BUILD_AS_SINGLE_FILE) {
    http = require('http');
    fs = require('fs');
    util = require('../common/util');
    qputs = util.qputs;
    EventEmitter = require('events').EventEmitter;
}

/** By default, HttpServer knows how to return static files from the current directory. Add new route
 regexs using HttpServer.on(). */

class HttpServer extends EventEmitter {

    constructor() {
        super();

        this.routes = [];
        this.running = false;
    }

    /**
     * tart the server listening on the given port
     * @param port
     * @param hostname
     * @return {*}
     */
    start(port, hostname) {
        if (this.running) {
            return;
        }
        this.running = true;

        port = port || 8000;
        this.hostname = hostname || 'localhost';
        this.port = port;
        this.connections = [];

        this.server = http.createServer((req, res) => {
            this.route_(req, res);
        });
        this.server.on('connection', (c) => {
            // We need to track incoming connections, beause Server.close() won't terminate active
            // connections by default.
            c.on('close', () => {
                let idx = this.connections.indexOf(c);
                if (idx !== -1) {
                    this.connections.splice(idx, 1);
                }
            });
            this.connections.push(c);
        });
        this.server.listen(port, hostname);

        this.emit('start', this.hostname, this.port);
        return this;
    }

    /** Terminate the server */
    stop() {
        if (!this.running) {
            return;
        }
        this.running = false;
        this.connections.forEach((c) => {
            c.destroy();
        });
        this.server.close();
        this.server = null;
        this.emit('end');
    }

    /**
     * When an incoming request matches a given regex, route it to the provided handler:
     *              function(url, ServerRequest, ServerResponse)
     *
     * @param regex
     * @param handler
     * @return {HttpServer}
     */
    addRoute(regex, handler) {
        this.routes.unshift({regex: regex, handler: handler});
        return this;
    }

    removeRoute(regex, handler) {
        this.routes = this.routes.filter((r) => {
            return !((regex === r.regex) && (!handler || handler === r.handler));
        });
        return this;
    }

    route_(req, res) {
        for (let i = 0; i < this.routes.length; i++) {
            if (req.url.match(this.routes[i].regex)) {
                this.routes[i].handler(req.url, req, res);
                return;
            }
        }
        if (req.method === 'GET') {
            this.serveFile_('.' + req.url, res);
        } else {
            res.writeHead(405, {"Content-Length": "0"});
            res.end();
        }
    }

    serveFile_(file, response) {
        if (file.lastIndexOf('report') !== -1) {
            doReport(response);
            return;
        }
        if (file === './') {
            file = 'index.html';
        }

        // 注意这个 坑爹的地方，下面注释的代码是官方的写法. 其实, 直接用 node 中的 __dirname 就好了
        // file = process.cwd() + '/node_modules/pomelo-robot/lib/console/' + file;
        file = `${__dirname}/${file}`;

        fs.stat(file, (err, stat) => {
            if (err) {
                response.writeHead(404, {"Content-Type": "text/plain"});
                response.write("Cannot find file: " + file);
                response.end();
                return;
            }

            fs.readFile(file, "binary", (err, data) => {
                if (err) {
                    response.writeHead(500, {"Content-Type": "text/plain"});
                    response.write("Error opening file " + file + ": " + err);
                } else {
                    if (file.lastIndexOf('.html') === -1) {
                        response.writeHead(200, {'Content-Length': data.length});
                        response.write(data, "binary");
                    } else {
                        response.writeHead(200, {
                            'Content-Length': data.length,
                            "Content-Type": "text/html; charset=utf-8"
                        });
                        response.write(data, "binary");
                    }
                }
                response.end();
            });
        });
    }

}


function doReport(response) {
    // todo
    let pdata = Stat.getInstance().getData();
    //console.log('pdata %j',pdata);
    let mdata = [];
    let _show = false;

    __.each(pdata, (val, key) => {
        let single = {};
        _show = true;
        single.name = key;
        single.uid = key;
        let keycolumns = [];
        let maxId = 0;

        __.each(val, (kval, akey) => {
            let _length = __.size(kval);
            if (_length > maxId) {
                maxId = _length;
            }
            if (_length > 0) {
                keycolumns.push(akey);
            }
        });

        let gcolumns = [];
        gcolumns.push('users');
        let glastkeyData = {};

        __.each(keycolumns, (dkey) => {
            gcolumns.push(dkey);
        });

        let grows = [];

        let i;
        for (i = 0; i < maxId; i++) {
            let rows = [];
            rows.push(i + 1);
            __.each(keycolumns, (dkey) => {
                //console.log('dkey' + dkey + ' ' +i + JSON.stringify(val[dkey]))
                rows.push(val[dkey][i] || 0);
                //_vaild = true;
            });
            grows.push(rows);
        }

        let gsummary = {};

        __.each(keycolumns, (dkey) => {
            let summary = {};
            let kdata = val[dkey];
            let min = Number.MAX_VALUE, max = 0;
            let sindex = 0, sum = 0;
            __.each(kdata, (time) => {
                if (time > max) {
                    max = time;
                }
                if (time < min) {
                    min = time;
                }
                sum += time;
                ++sindex;
            });
            let avg = Math.round(sum / sindex);
            summary = {'max': max, 'min': min, 'avg': avg, 'qs': Math.round(i * 1000 / avg)};
            gsummary[dkey] = (summary);
        });

        single.summary = gsummary;
        single.charts = {"latency": {"name": "robot", "uid": single.uid, "columns": gcolumns, "rows": grows}};

        if (grows.length > 0) {
            mdata.push(single);
        }
    });

    if (_show) {
        let data = JSON.stringify(mdata);
        //response.writeHead(200, { 'Content-Length': pdata.length });
        response.write(data, "binary");
    }

    response.end();
}


exports.HttpServer = HttpServer;
// =================
// Singletons
// =================
/** The global HTTP server used by nodeload */
let HTTP_SERVER = exports.HTTP_SERVER = new HttpServer();
HTTP_SERVER.on('start', (hostname, port) => {
    qputs('Started HTTP server on ' + hostname + ':' + port + '.');
});

HTTP_SERVER.on('end', () => {
    qputs('Shutdown HTTP server.');
});
 
