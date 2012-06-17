// Please refer to the bottom of the file for instructions

SET_EXECUTION_OPTIONS(EVENT_QUEUE | NO_GC_NOTIFY);

var log = require("log"),
    RPC = require("rpc"),
    timer = require("timer"),
    json = require("json");

function Server() {

    var self = this;
	var clients = { }			//#	random generators uids
	self.client_uuid_i = 0;		//# random generators daisy-chain index 
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
        http_port: 81,                              // http port this rpc is bound to
		connect_async: false,                       // if client, this will block 
        service: "ws-server-rpc"                    // websocket name		
    });

	//# an interface for all random generators to connect to
	self.rpc_random = new RPC({
        options: { verbose: true, trace: true },  // useful for debugging
        as_server: true,                            // server or client
        uuid: self.uuid,                            // uuid of this rpc endpoint (string)
        http_port: 82,                              // http port this rpc is bound to
		connect_async: false,                       // if client, this will block 
        service: "ws-random"                    // websocket name		
    });

    // tell http server associated with this rpc instance (by port)
    // to handle following folders (relative to rte folder)
    self.rpc.http_digest({
        "/": "/odesk/http",
         "/scripts": "/http/scripts",
        "/aspect": "/http/aspect"
    });
		
	self.rpc_random.on_connect = function(uuid, service) 
	{ 
		log.debug("random generator is connected: uuid="+uuid+" service="+service);
		clients[uuid] = this;		//# store instance when connected
		log.debug("existing clients:");
		log.debug(Object.keys(clients));
	}     
	self.rpc_random.on_disconnect = function(uuid, service) 
	{ 
		log.debug("random generator is disconnected: uuid="+uuid+" service="+service);
		delete clients[uuid]; 		//# remove instance when disconnected
	} 
	
    // test rpc function that will be called from the web page
	self.rpc.iface.get_random = function(msg)
    {		
            log.debug("Got RPC message:");
			log.debug(msg);            
			
			//# forward the request to random generator.
			//# the response coming from the random generator is 
			//# sent to a web page in 'self.rpc_client.on_random'			
			
			//# get the keys of 'clients' dictionary
			var all_clients_uuids = Object.keys(clients);
			
			//# alert if no random generator is connected and exit
			if(all_clients_uuids.length==0) {
				log.error("no random generators connected");
				return;
			}
			
			//# start the daisy-chain over if the index is out of bounds
			if(self.client_uuid_i >= all_clients_uuids.length)
				self.client_uuid_i = 0;
			
			//# select random generator uuid from the dictionary
			var client_uuid = all_clients_uuids[self.client_uuid_i];
			
			//# move the index to the next element in chain (or start over)
			self.client_uuid_i = (self.client_uuid_i+1)%all_clients_uuids.length;
			
			//# request a random number from the selected random generator
			self.rpc_random.dispatch(
				client_uuid, 
				{
					op: "get_random"
				}
			);			           
    }
	
	//# response from the random generator. the message is forwarded to a web page
	self.rpc_random.iface.on_random = function(msg)
	{
			log.debug("RPC message from random generator:");
			log.debug(msg);					
			log.debug("random_number: "+msg.args.random_number);
			log.debug("supplier_uuid: "+msg.args.supplier_uuid);
			
			// send response to a web page
            self.rpc.dispatch({
                op : "on_random",
                args :
                {
                    random_number : msg.args.random_number,
					proxy_uuid    : self.uuid,
                    supplier_uuid : msg.args.supplier_uuid
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

/*

NOTES:

------ RPC in general

RPC messages carry two important parameters:  'op' and 'args'

op - is the name of the function to be invoked on the target endpoint
args - is an object containing arbitrary data to be passed to the function

When message is received by the rpc object, it is passed to the 
RPC::dispatch() function (refer to rpc.js). dispatch() function 
(overloadable) looks into the 'iface' object for presence of the 
target function (in the 'op') argument and invokes it if found.
Hence to declare a new handler function developer must declare 
it in the following manner:

rpc_object.iface.my_handler_function = function(msg) { }

msg is the only argument that will contain the rpc message.

----- Creating client connection

The above example implements an RPC server.  To implement and rpc client
(i.e. to connect to a another process) following arguments to the RPC
object must be supplied:

self.rpc_client = new RPC({
    options: { verbose: false, trace: false },  // useful for debugging
    as_server: false,                           // <--- client
    uuid: self.uuid,                            // uuid of this rpc endpoint (string)
    address: "ws://127.0.0.1/websocket-name"    // websocket address of the target endpoint
});

----- Sending RPC messages

To send RPC message to an endpoint, you can use RPC::dispatch() function.
This function can be either invoked as follows:

myrpc.dispatch({ ..message.. });  in which case it will broadcast to all connections

or as follows:

myrpc.dispatch(uuid, { ..message.. }); in which case the message will be sent
only to the endpoint with target UUID.

Endpoint UUID is supplied to an RPC object as one of the creation arguments (as seen above).
When connection with endpoint is established, RPC::on_connect(uuid) is called with the first
argument containing UUID of the endpoint. For example, you can store references to endpoints
like this:

var clients = { }   // declare global storage object
rpc.on_connect = function(uuid, service) { clients[uuid] = this; }     // store instance when connected
rpc.on_disconnect = function(uuid, service) { delete clients[uuid]; }  // remove instance when disconnected

========================================================
=== THE TASK

1 - Create another process running in parallel, call it "random-generator.js". 
    You can do this by duplicating most of the functionality in this file.
    
    Create a new RPC instance for communication with it. Don't reuse RPC used
    for communication with the web page.

    New process should now take the responsibility of generating random 
    numbers.  Thus RPC requests from the web page should be redirected to
    the random generator (using this current process as a 'proxy'), the new process 
    should generate the random number and return it to this process, which should relay 
    it back to the web page.

2 - Keep track of RPC connections as described above.  Allow multiple random generator
    processes to be started (all of them connecting to this process).  Redirect random
    number requests to them in a daisy-chain manner.  Each time the user presses a
    button in the user interface, 'next in a sequence' process should be invoked 
    for random number generation (unless there is just one).

    The end result is that in the user interface, when you click on the button,
    a random number will appear and a beside it the UUID of the process that has
    generated it will appear.

*/