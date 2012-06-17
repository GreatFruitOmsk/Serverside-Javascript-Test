SET_EXECUTION_OPTIONS(EVENT_QUEUE | NO_GC_NOTIFY);

var log = require("log"),
    RPC = require("rpc"),
    timer = require("timer"),
    json = require("json");

function RandomGenerator() {

    var self = this;
    self.uuid = generate_uuid();

    log.info("Server UUID: "+self.uuid);
    log.info("Creating RPC interface");

    //# RPC client for server.js
    self.rpc =  new RPC({
		options: { verbose: false, trace: false },  // useful for debugging
		as_server: false,                           // <--- client
		uuid: self.uuid,                            // uuid of this rpc endpoint (string)
		address: "ws://127.0.0.1:82/ws-random"    // websocket address of the target endpoint
	});

	// request from random.js
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

var generator = new RandomGenerator();