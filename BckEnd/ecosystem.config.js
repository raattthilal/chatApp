module.exports = {
    apps : [
    {
      name: 'admin - Suchitwa Mission Microservices',
      script: 'admin.service.js',
      // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      //cron_restart
      env: {
        NODE_ENV: 'development',
        port : 7051
      }
    },
    {
      name: 'mobile - Suchitwa Mission Microservices',
      script: 'mobile.service.js',
      // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      //cron_restart
      env: {
        NODE_ENV: 'development',
        port : 7052
      }
    }
    ],
    "deploy" : {
      // "production" is the environment name
      "development" : {
        "user" : "root",
        "host" : ["172.104.61.150"],
        "ref"  : "origin/master",
        "repo" : "git@github.com:jinujd/repository.git",
        "path" : "/opt/trois/suchitwa-mission",
        "post-deploy" : "npm install && pm2 startOrRestart ./suchitwa-mission-microservices/ecosystem.config.js --env development;"
       },
      }
  };