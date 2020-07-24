module.exports = (app, methods, options) => {
    const admin = methods.loadController('admin', options);
    

    //District

    admin.methods.post('/masters/districts', admin.createDistrict, {
        auth: true
    });

    admin.methods.get('/masters/districts', admin.listDistrict, {
        auth: true
    });
   
    admin.methods.patch('/masters/districts/:id', admin.updateDistrict, {
        auth: true
    });
    admin.methods.get('/masters/districts/:id', admin.getDistrict, {
        auth: true
    });
    admin.methods.delete('/masters/districts/:id', admin.deleteDistrict, {
        auth: true
    });

    admin.methods.post('/login', admin.login, { auth: false });
}
