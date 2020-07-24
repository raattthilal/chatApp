module.exports = function RoleHierarchy(sequelize) {
    var Sequelize = sequelize.constructor;
    var authRole = require('./authRole.model') (sequelize);
    var ret =
      sequelize.define('roleHierarchy', {
        parent_auth_role_id: {
          type: Sequelize.INTEGER,
          defaultValue: null
        },
        child_auth_role_id: {
          type: Sequelize.INTEGER,
          defaultValue: null
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
        tableName: 'role_hierarchy',
        timestamps: false
  
      });
  
     ret.belongsTo(authRole, { 
      foreignKey: 'parent_auth_role_id',
      as: 'parentAuthRole',
     }); 
    ret.belongsTo(authRole, { 
      foreignKey: 'child_auth_role_id',
      as: 'childAuthRole',
    }); 
    return ret;
  }
  