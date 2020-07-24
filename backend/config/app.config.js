var commonStorePath = 'http://172.104.61.150/suchitwa-mission/'
module.exports = {
  sms: {
    fromNo: "SuchMn",
    key: "283326AymztR8ZQe5ecbbf20P1",
    route: "4"
  },
  jwt: {
    expirySeconds: 60 * 60
  },
  gateway: {
    url: "http://localhost:7050"
  },
  onesignal:{
    appId :'34f862d3-1322-4fbd-9e5a-f73159b7ec87',
    apiKey:'YzM5OTBlYzMtZWFiOS00NGY3LTk2MDMtOTc2ZTQzNzlmODgz'
  }
  ,
  profile: {
    imageBase: commonStorePath + 'uploads/',
    uploadPath: "/var/www/html/suchitwa-mission/uploads",
    //uploadPath: "./uploads"
  },
  otp: {
    expirySeconds: 2 * 60
  }
}
