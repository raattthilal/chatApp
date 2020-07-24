const express = require('express');
var cors = require('cors');
const bodyParser = require('body-parser');
var consoleArguments = require('minimist');
var argv = consoleArguments(process.argv.slice(2));
// Configuring the database
var env = process.env.NODE_ENV;
env = env ? env : "development";
console.log("Environment is " + env);
const dbConfig = require('./config/database.config.js')[env];

if (!dbConfig) {
  console.log("Database configuaration for environment " + env + " is not in the db config file. Exiting...");
  process.exit(0);
}
const params = require('./config/params.config');

const Sequelize = require('sequelize');
const Controller = require('./base/controller.js');

var sequelize = null;
//jwttoken and verification


// create express app
const app = express();

app.use(cors());
app.use(bodyParser.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: true
}));

module.exports = {
  connectToDb: function(callback) {  
    this.connectToMysqlDb(dbConfig.sql,function(sequelize){
        callback({
            sequelize:sequelize,
        });
    })
},
connectToMysqlDb: function (dbConfig,callback) {
  console.log("Db config is ");
  console.log(JSON.stringify(dbConfig));
 sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
     host: dbConfig.host,
     dialect: dbConfig.dialect,
    //  dialect: 'postgres',
     logging: dbConfig.logging,
     pool: {
      max: 9,
      min: 0,
      idle: 10000
    }
   });
 sequelize
   .authenticate()
   .then(() => {
     //console.log('Connected to sql.');
     if (callback) {
       callback(sequelize);
     }
   })
   .catch(err => {
     console.error('Unable to connect to the database:', err);
     process.exit();
   });
},
  methods: {
    loadController: function (controller, options) {
      var config = params[env] ? params[env] : {
        jwt: {
          secret: "myapp"
        }
      };
      config.options = options;
      var controllerBaseObj = new Controller(controller, app, config);

      var path = './app/controllers/' + controller + ".controller.js";
      //console.log("Loading controller " + path);
      var controller = require(path);
      controller = new controller(controllerBaseObj, options);

      controller.methods = controllerBaseObj;
      controller.options = options;
      return controller;
    }
  },
  start: function (serviceName, routes) {
    var that = this;
    this.connectToDb(function (db) {
      var options = db
      var port = process.env.port ? process.env.port : null;
      port = port ? port : argv.port ? argv.port : null;
      if (!port) {
        console.log("PORT not set for " + serviceName + " service");

        process.exit(0);
      }
      if (routes) {
        var len = routes.length ? routes.length : 0;
        var i = 0;
        var route = null;
        while (i < len) {
          route = routes[i];
          //console.log("Loading route " + route);
          require('./app/routes/' + route + '.routes.js')(app, that.methods, options);
          i++;
        }
        app.listen(port, () => {
          console.log("Server is listening on port " + port);           
        });
      }

    });  
  }
};
