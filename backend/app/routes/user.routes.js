module.exports = (app, methods, options) => {
    const admin = methods.loadController('admin', options);
    const mobile = methods.loadController('mobile', options);

 
    mobile.methods.post('/users/login',mobile.login, {auth:false});

    mobile.methods.post('/users/send-otp',mobile.sendOtp, {auth:false});
    mobile.methods.post('/users/validate-otp',mobile.validateOtp, {auth:false});
    mobile.methods.patch('/users/reset-password',mobile.resetPassword, {auth:true});
    mobile.methods.get('/testfn',mobile.testfn, {auth:false});
    mobile.methods.patch('/users/change-password', mobile.changeUserPassword, {
        auth: true
    });
        //categoryFacilitySurveyQuestion
        mobile.methods.post('/upload-check', mobile.uploadCheck, {
            auth: false,
            multer : mobile.getMulter
        });
        mobile.methods.post('/facility-surveys', mobile.attendFacilitySurvey, {
            auth: true
        });
        mobile.methods.post('/facility-surveys/:id/image', mobile.uploadFacilitySurveyImage, {
            auth: true,
            multer : mobile.getMulter
        });

        mobile.methods.get('/facility-surveys/common-details', mobile.facilitySurveyCommonDetails, {
            auth: true
        }); 
       
        mobile.methods.post('/main-surveys', mobile.attendSurvey, {
            auth: true, 
            // multer : mobile.getMulter
        });
        mobile.methods.get('/main-surveys/common-details', mobile.mainSurveyCommonDetails, {
            auth: true
        });
        mobile.methods.post('/main-surveys/:id', mobile.attendSurvey, {
            auth: true, 
            // multer : mobile.getMulter
        });

        mobile.methods.get('/profile', mobile.getUser, {
            auth: true
        });

        mobile.methods.patch('/update-profile', mobile.updateUser, {
            auth: true
        });

        mobile.methods.get('/main-survey-history', mobile.getMainSurveyHistory, {
            auth: true
        });
        mobile.methods.get('/version', admin.getVersion, {
            auth: true
        });
        mobile.methods.get('/notification-history', mobile.listNotificationHistory, {
            auth: true
        });
    mobile.methods.patch('/users/:id', mobile.updateUser, {
        auth: true
    });
        mobile.methods.get('/test/',mobile.testfn,{auth:false});


       
}