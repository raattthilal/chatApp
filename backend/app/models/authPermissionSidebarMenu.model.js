module.exports = function AuthPermissionSidebarMenu(sequelize) {
    var Sequelize = sequelize.constructor;
  var authPermission = require('./authPermission.model')(sequelize);
  var sidebarMenu = require('./sidebarMenu.model')(sequelize);

    var ret =
      sequelize.define('authPermissionSidebarMenu', {
        sidebar_menu_id: {
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
        tableName: 'auth_permission__sidebar_menu',
        timestamps: false
  
      });  
        sequelize.define('authPermissionSidebarMenu', {
        // [other columns here...]
        is_allow: Sequelize.VIRTUAL
      });
  
      ret.belongsTo(sidebarMenu, {foreignKey: 'sidebar_menu_id'});
      ret.belongsTo(authPermission, {foreignKey: 'auth_permission_id'});
  
    return ret;
  }
  