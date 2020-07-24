module.exports = function AuthRolePermission(sequelize) {
    var Sequelize = sequelize.constructor;

    var AuthPermission = require('./authPermission.model') (sequelize);

    var ret =
      sequelize.define('authRolePermission', {
        role_id: {
          type: Sequelize.INTEGER
        },
        auth_permission_id: {
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
        tableName: 'auth_role__permission',
        timestamps: false
  
      });
      sequelize.define('authRolePermission', {
        // [other columns here...]
        is_allow: Sequelize.VIRTUAL
      });
      ret.belongsTo(AuthPermission, {foreignKey: 'auth_permission_id',as: 'permission'});
    return ret;
  }
  