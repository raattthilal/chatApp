var server = require('./server.js'); 
var routes = ['master'];
var serviceName = "admin";
server.start(serviceName, routes);