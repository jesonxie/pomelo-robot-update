let _node = {Node: Node};

class WebClient {

    constructor(io) {
        this.nodes = {};
        this.ids = {};
        this.streams = {};
        this.count = 0;
        this.detailTimer = false;
        this.histories = {};
        this.stats = {messages: 0, nodes: 0, start: new Date()};
        this.connected = false;

        this.socket = io('http://' + window.location.hostname + ':8888');

        this.socket.on('connect', () => {
            this.connected = true;
            this.socket.emit('announce_web_client');

            let REPORT_INTERVAL = 3 * 1000;
            setInterval(() => {
                this.socket.emit('webreport', {});
            }, REPORT_INTERVAL);

            let detailId = setInterval(() => {
                if (this.detailTimer) {
                    this.socket.emit('detailreport', {});
                }
            }, REPORT_INTERVAL);
        });

        let isInited = false;

        // Add a new Node to pool
        this.socket.on('add_node', (message) => {
            console.log(JSON.stringify(message));
            let nodeId = message.nodeId;
            let iport = message.iport;
            if (!this.ids[nodeId]) {
                this.add_node(nodeId, iport);
                this.ids[nodeId] = nodeId;
                showUI('block');
            } else {
                console.log('duplicated server add ' + nodeId);
            }
        });

        // Remove Node from pool
        this.socket.on('remove_node', (message) => {
            this.remove_node(message.node);
        });

        //report status
        this.socket.on('webreport', (snum, suser, stimeData, sincrData) => {
            //doReport(timeData);
            $('#agentinput').val(snum);
            $('#maxuserinput').val(suser);
            updateIncrData(sincrData);
            updateTimesData(snum, suser, stimeData);
        });

        this.socket.on('detailreport', (message) => {
            doReportDetail(message);
        });

        /* temporary code */
        this.socket.on('error', (message) => {
            $("#errorinput").html('[' + message.node + ']:' + message.error).end();
        });
        /* temporary code */

        this.socket.on('statusreport', (message) => {
            let nodeId = message.id;
            let status = message.status;
            let hit = '';
            if (status === 0) {
                hit = 'IDLE';
            }
            if (status === 1) {
                hit = 'READY';
                $('#run-button').css('display', '')
            }
            if (status === 2) {
                hit = 'RUNNING';
                $('#run-button').css('display', 'none');
            }

            $("#hitdiv").html(hit);
        });

        // Update total message count stats
        this.socket.on('stats', (message) => {
            if (!this.stats.message_offset) {
                this.stats.message_offset = message.message_count;
            }
            this.stats.messages = message.message_count - this.stats.message_offset;
        });
    }

    add_node(nodeId, iport) {
        let node = new _node.Node(nodeId, iport, this);
        node.render();
        this.nodes[nodeId] = node;
        this.stats.nodes++;
        if (this.stats.nodes >= parseInt($('#agentinput').val())) {
            $('#ready-button').val('ReReady');
            $('#run-button').show();
        } else {
            $('#ready-button').val('Readying');
            $("#run-button").css('display', 'none');
        }
    }

    remove_node(nodeId) {
        let node = this.nodes[nodeId];
        if (!!node) {
            node.destroy();
            delete this.nodes[node.nodeId];
        }
        this.stats.nodes--;
        if (this.stats.nodes <= 0) {
            showUI('none');
            this.stats.nodes = 0;
        }
        delete this.ids[nodeId];
    }

    // Resize screens, defined in web_client.jquery.js
    resize() {
        throw Error("WebClient.resize() not defined");
    }
}

function doReportDetail(msg) {
    updateDetailAgent(msg.detailAgentSummary, ' Summary');
    updateAvgAgent(msg.detailAgentAvg, ' Response Time');
    updateEveryAgent(msg.detailAgentQs, 'qs_div', ' Qps Time');
}

function doReport(message) {
    updateMain(message.globaldata);
}

function showUI(value) {
    //$("#run-button").css('display',value);
    //$("#runcode-button").css('display',value);
    //$("#codeinput").css('display',value);
}

// Export for node unit tests
try {
    exports.WebClient = WebClient;
} catch (err) {

}
