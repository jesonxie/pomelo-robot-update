let cp = require('child_process');
let fs = require('fs');
let vm = require('vm');
let path = require('path');

class Starter {

    constructor() {
        this.parallelRunning = true;
    }

    /**
     * begin notify to run agent
     * @param main
     * @param message
     * @param clients
     */
    run(main, message, clients) {
        if (!clients) {
            clients = ['127.0.0.1'];
            this.prepare(main, message, clients);
        }
        else {
            this.prepare(main, message, clients);
        }
    }

    /**
     *
     * @param main
     * @param message
     * @param clients
     */
    prepare(main, message, clients) {
        let count = parseInt(message.agent, 10) || 1;
        for (let ipIndex in clients) {
            if (clients.hasOwnProperty(ipIndex)) {
                for (let i = 0; i < count; i++) {
                    let cmd = 'cd ' + process.cwd() + ' && ' + process.execPath + ' ' + main + ' client > log/.log';
                    let ip = clients[ipIndex];
                    if (ip === '127.0.0.1') {
                        this.localrun(cmd);
                    }
                    else {
                        this.sshrun(cmd, ip);
                    }
                }
            }
        }
    }

    sshrun(cmd, host, callback) {
        let hosts = [host];
        log('Executing ' + $(cmd).yellow + ' on ' + $(hosts.join(', ')).blue);
        let wait = 0;
        let data = [];
        if (hosts.length > 1) {
            this.parallelRunning = true;
        }
        hosts.forEach((host) => {
            wait += 1;
            spawnProcess('ssh', [host, cmd], (err, out) => {
                if (!err) {
                    data.push({
                        host: host,
                        out: out
                    });
                }

                if (--wait === 0) {
                    this.parallelRunning = false;
                    if (err) {
                        this.abort('FAILED TO RUN, return code: ' + err);
                    }
                    else if (callback) {
                        callback(data);
                    }
                }
            });
        });
    }

    localrun(cmd, callback) {
        log('Executing ' + $(cmd).green + ' locally');
        spawnProcess(cmd, ['', ''], (err, data) => {
            if (err) {
                this.abort('FAILED TO RUN, return code: ' + err);
            }
            else {
                if (callback) {
                    callback(data);
                }
            }
        });
    }


    set(key, def) {
        if (typeof def === 'function') {
            this.__defineGetter__(key, def);
        }
        else {
            this.__defineGetter__(key, () => {
                return def;
            });
        }
    }

    load(file) {
        if (!file) {
            throw new Error('File not specified');
        }
        log('Executing compile ' + file);
        let code = coffee.compile(fs.readFileSync(file).toString());
        let script = vm.createScript(code, file);
        script.runInNewContext(this);
    }

    abort(msg) {
        log($(msg).red);
        //process.exit(1);
    }

}

module.exports = new Starter();


let log = function () {
    console.log([].join.call(arguments, ' '));
};

function addBeauty(prefix, buf) {
    let out = prefix + ' ' + buf
        .toString()
        .replace(/\s+$/, '')
        .replace(/\n/g, '\n' + prefix);
    return $(out).green;
}

function spawnProcess(command, options, callback) {
    let child = null;
    if (!!options[0]) {
        child = cp.spawn(command, options);

    } else {
        child = cp.exec(command, options);
    }

    let prefix = command === 'ssh' ? '[' + options[0] + '] ' : '';
    prefix = $(prefix).grey;

    //child.stderr.on('data', function (chunk) {
    //    log(addBeauty(chunk));
    //});

    let res = [];
    child.stdout.on('data', function (chunk) {
        res.push(chunk.toString());
        log(addBeauty(chunk));
    });

    function addBeauty(buf) {
        return prefix + buf
            .toString()
            .replace(/\s+$/, '')
            .replace(/\n/g, '\n' + prefix);
    }

    child.on('exit', function (code) {
        if (callback) {
            callback(code === 0 ? null : code, res && res.join('\n'));
        }
    });
}

// Stylize a string
function stylize(str, style) {
    let styles = {
        'bold': [1, 22],
        'italic': [3, 23],
        'underline': [4, 24],
        'cyan': [96, 39],
        'blue': [34, 39],
        'yellow': [33, 39],
        'green': [32, 39],
        'red': [31, 39],
        'grey': [90, 39],
        'green-hi': [92, 32],
    };
    return '\033[' + styles[style][0] + 'm' + str +
        '\033[' + styles[style][1] + 'm';
}

function $(str) {
    str = new String(str);
    ['bold', 'grey', 'yellow', 'red', 'green', 'cyan', 'blue', 'italic', 'underline'].forEach(function (style) {
        Object.defineProperty(str, style, {
            get: function () {
                return $(stylize(this, style));
            }
        });
    });
    return str;
}

stylize.$ = $;
