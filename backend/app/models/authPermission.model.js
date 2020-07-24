module.exports = function AuthPermission(sequelize) {

    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('authPermission', {
        permission: {
          type: Sequelize.STRING
        },
        auth_controller_id: {
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
        tableName: 'auth_permission',
        timestamps: false
  
      });

    return ret;
  }
  