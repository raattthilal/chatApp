module.exports = function SidebarMenu(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('sidebarMenu', {
        name: {
          type: Sequelize.STRING
        },
        icon: {
          type: Sequelize.STRING
        },
        link: {
          type: Sequelize.STRING
        },
        parent_sidebar_menu_id: {
          type: Sequelize.STRING
        },
        is_user_list_main_menu: {
          type: Sequelize.INTEGER
        },
        sort_order: {
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
        tableName: 'sidebar_menu',
        timestamps: false
  
      });
      ret.belongsTo(ret, {
        as: 'parent_sidebar_menu',
        foreignKey: 'parent_sidebar_menu_id',
        required: false
    });
    return ret;
  }
  