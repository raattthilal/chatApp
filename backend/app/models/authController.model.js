module.exports = function AuthController(sequelize) {
    var Sequelize = sequelize.constructor;
    var authPermission = require('./authPermission.model') (sequelize);

    var ret =
      sequelize.define('authController', {
        name: {
          type: Sequelize.STRING
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
        tableName: 'auth_controller',
        timestamps: false
  
      });
      ret.hasMany(authPermission, {foreignKey: 'auth_controller_id',
        as: 'permissions'
    });

    return ret;
  }
  