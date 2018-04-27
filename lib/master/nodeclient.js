let __ = require('underscore');


class NodeClient {

    /**
     * NodeClient is a server/machine/instance running a agent socket
     * @param nodeId
     * @param socket
     * @param server
     */
    constructor(nodeId, socket, server) {
        this.nodeId = nodeId;
        this.socket = socket;
        // this.iport = socket.handshake.address.address + ":" + socket.handshake.address.port;
        this.iport = socket.handshake.address + ":" + socket.handshake.port;
        this.id = socket.id;
        this.log_server = server;

        // Join 'nodes' room
        socket.join('nodes');

        socket.on('disconnect', () => {
            // Notify all WebClients upon disconnect
            __(this.log_server.web_clients).each((web_client, client_id) => {
                web_client.remove_node(this);
            });
            socket.leave('nodes');
        });

    }

}

module.exports = {
    NodeClient: NodeClient
};
