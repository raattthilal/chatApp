var server = require('./server.js'); 
var routes = ['user'];
var serviceName = "mobile";
server.start(serviceName, routes);