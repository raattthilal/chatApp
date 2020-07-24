const stringify = require('json-stringify-safe');
var multer = require('multer'); 
module.exports = function(name,app,config) {
    
    const jwt = require('jsonwebtoken');
    this.options = {auth:true};
    var that = this;
    this.actionsWithoutAuth = [];
    this.get = function(path,fn,options) {
       // //console.log("Get route registered...");
        ////console.log("Path is this: "+path);
       // //console.log("Options in get is "+JSON.stringify(options));
        this.registerRoute('get',path,fn,options);
    };
    this.loadModel =  function(model) {
        var path  = '../app/models/'+model+'.model.js';
        var model = require(path)(config.options.sequelize);
        return model;
    };
    this.post = function(path,fn,options) {
        this.registerRoute('post',path,fn,options);
    };
    this.delete = function(path,fn,options) {
        this.registerRoute('delete',path,fn,options);
    };
    this.patch = function(path,fn,options) {
        this.registerRoute('patch',path,fn,options);
    };
    this.registerRoute = function(method,path,fn,options) {
        //console.log("\\n\\n\\n\\n\\n\\n\\nCalling n");
        path  = path.replace(/\/\//g, "/");
        //console.log("Registering route "+method.toUpperCase()+" "+path+" with options "+JSON.stringify(options));
        if(!fn) {
            //console.log("Unable to register route "+method.toUpperCase()+" "+path+", callback function is undefined...");
            return;
        }
        var methods = ["get","post","put","patch","delete","head"];
        if(methods.indexOf(method) == -1) {
            //console.log("Invalid method "+method+" passed to registerRoute. Available methods are "+methods);
            return;
        }
        options = options?options:this.options;
        //console.log("Options received: "+JSON.stringify(options));
        var path = options.useAbsolutePath?path:"/"+name+`/${path}`;
        //console.log("Options  is "+JSON.stringify(options));
        path  = path.replace(/\/\//g, "/");
        if(!options.auth) { 
            this.actionsWithoutAuth[method] = !this.actionsWithoutAuth[method]?[]:this.actionsWithoutAuth[method];
            this.actionsWithoutAuth[method].push(path); 
        } else { 
        }
        //console.log(`app.${method}('${path}',fn)`);
        // app.use(path, function(req,res,next) { 
        //     var params = req.params;
        //     authHandler(path,params,req,res,next);
        //     //console.log("Req params are "+JSON.stringify(req.params));
        // });
        // app[method](path,fn);
        var param2 = function(req,res,next) { 
            var params = req.params;
            authHandler(path,params,req,res,next); 
            //console.log("Req params are "+JSON.stringify(req.params));
         }; 
         var param3 = null; 
         if(!options.multer) { 
            app.use(path, param2 ); 
            app[method](path, fn); 
         } else{ 
            param3 = param2;
            param2 = (options.multer)(multer); 
            app[method](path, param2, function(req,res,next) { 
                var params = req.params;
                authHandler(path,params,req,res,function() { 
                    fn.call(null,req,res,next);
                }); 
                //
            }); 
            //app.use(path, param2, param3 ); // for authorization
         }
    };
   // app.use(authHandler);
    function authHandler(path, params, req, res, next){  
        //console.log(JSON.stringify(req.params)); 
        //console.log("Path is "+path);
        var route = app.route(path);
        if(route && route.path) {
            path = route.path;
        } 
        //path = path[path.length-1];
        if(!path) {
            //console.log("Invalid path");
            return;
        }
        path  = path.replace(/\/\//g, "/");
        //console.log("path is "+ path);
        var method =  req.method.toLowerCase();
        var noAuthActions  =  that.actionsWithoutAuth[method]?that.actionsWithoutAuth[method]:[];
        //console.log("No auth actions are...");
        //console.log("Path is "+path);
        //console.log(noAuthActions);
        if(noAuthActions.indexOf(path) != -1) {
            //console.log("Path does not require authorization...");
            next.call();
            return;
        } else {
            if( Object.keys(req.params).length != 0 ) { 

            } else { 
                //console.log("Path parameters are not there");
            }
        }
        const bearerHeader = req.headers['authorization'];
        var bearer = null;
        var token = null;
        if (typeof bearerHeader == 'undefined' || !(bearer = bearerHeader.trim().split(' ')) || !(token = bearer[1])) {
            res.sendStatus(401);
            return;
        }
        //console.log(bearer);
        //console.log("JWT token received is "+token);
        //console.log("JWT secret received is "+config.jwt.secret);
        jwt.verify(token, config.jwt.secret, (err, authData) => {   
            if (err) {
                //console.log("Invalid JWT token");
               return res.sendStatus(401);
            } else {
                //console.log(JSON.stringify(authData));
                req.identity = authData;
                //console.log("Token verified..");
                return next.call();
            }
        });
    }
}