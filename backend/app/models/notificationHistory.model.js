module.exports = function NotificationHistory(sequelize) {
    var Sequelize = sequelize.constructor;
    var notification = require('./notification.model') (sequelize);
    var lsgi = require('./lsgi.model')(sequelize);
    var lsgi_type = require('./lsgiType.model')(sequelize);
    var lsgi_block = require('./lsgiBlock.model')(sequelize);
    var user = require('./user.model')(sequelize);
    var district = require('./district.model')(sequelize);
    var ret =
        sequelize.define('notificationHistory', {
            id:{
                type: Sequelize.INTEGER,
                autoIncrement:true,
                allowNull:false,
                primaryKey:true
            },
            //notification table ID
            notification_id: {
                type: Sequelize.INTEGER
            },
            //User table ID sender
            user_id: {
                type: Sequelize.INTEGER
            },
            //User table ID recipient
            recipient_id: {
                type: Sequelize.INTEGER
            },
            //district table id
            district_id: {
                type: Sequelize.INTEGER
            },
            //lsgi table id
            lsgi_id: {
                type: Sequelize.INTEGER
            },
            //lsgi type table id
            lsgi_type_id: {
                type: Sequelize.INTEGER
            },
            //lsgi block table id
            lsgi_block_id: {
                type: Sequelize.INTEGER
            },
            //Read status
            read_status: {
                type: Sequelize.INTEGER
            },
            status: {
                type: Sequelize.INTEGER
            },
            created_at: {
                type: 'TIMESTAMP',
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                allowNull: false
            },
            modified_at: {
                type: 'TIMESTAMP',
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                allowNull: false
            },

        }, {
            tableName: 'notification_history',
            timestamps: false

        });

    //ret.hasMany(notification, {foreignKey: 'notification_id'});
    ret.belongsTo(notification, {foreignKey: 'notification_id'});
    ret.belongsTo(lsgi, { foreignKey: 'lsgi_id' });
    ret.belongsTo(lsgi_type, { foreignKey: 'lsgi_type_id' });
    ret.belongsTo(lsgi_block, { foreignKey: 'lsgi_block_id' });
    ret.belongsTo(user, { foreignKey: 'user_id' });
    ret.belongsTo(user, { foreignKey: 'recipient_id' });
    ret.belongsTo(district, { foreignKey: 'district_id' });

    return ret;
}