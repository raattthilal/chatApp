module.exports = function Notification(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('notification', {
        title: {
          type: Sequelize.STRING
        },
        content: {
          type: Sequelize.STRING
        },
        date_time: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
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
        tableName: 'notification',
        timestamps: false
  
      });
  
    return ret;
  }
  