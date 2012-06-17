SET_EXECUTION_OPTIONS(EVENT_QUEUE | NO_GC_NOTIFY);

var log = require("log"),
    RPC = require("rpc"),
    timer = require("timer"),
    json = require("json");

function Server() {

    var self = this;
    self.uuid = generate_uuid();

    log.info("Server UUID: "+self.uuid);
    log.info("Creating RPC interface");

    // establish RPC interface
    // RPC interface is a wrapper around websocket
    // in order to create a websocket server, the
    // system will also create an internal http server
    self.rpc = new RPC({
        options: { verbose: true, trace: true },  // useful for debugging
        as_server: true,                            // server or client
        uuid: self.uuid,                            // uuid of this rpc endpoint (string)
        http_port: 82,                              // http port this rpc is bound to
		connect_async: false,                       // if client, this will block 
        service: "ws-random"	                    // websocket name		
    });

    // tell http server associated with this rpc instance (by port)
    // to handle following folders (relative to rte folder)
    self.rpc.http_digest({
        "/": "/odesk/http",
         "/scripts": "/http/scripts",
        "/aspect": "/http/aspect"
    });
	
    // test rpc function that will be called from the web page
	self.rpc.iface.get_random = function(msg)
    {		
            log.debug("Got RPC message:");
			log.debug(msg);

            var n = Math.random();
            log.debug("Generating Random Number: "+n);
			
            // send response
            self.rpc.dispatch({
                op : "on_random",
                args :
                {
                    random_number : n,
                    supplier_uuid : self.uuid
                }
            });
    }
	
    // test function to allow web page to echo data in console
    self.rpc.iface.echo = function(msg)
    {		
			log.info(msg.args.text);
    }

}


var server = new Server();