module.exports = function AuthRole(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('authRole', {
        name: {
          type: Sequelize.STRING
        },
        is_mobile_secretary_section_role: {
          type: Sequelize.INTEGER
        },
        has_association_with_district: {
          type: Sequelize.INTEGER
        },
        has_association_with_lsgi_block: {
          type: Sequelize.INTEGER
        },
        has_association_with_lsgi: {
          type: Sequelize.INTEGER
        },
        has_association_with_ward: {
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
        tableName: 'auth_role',
        timestamps: false
  
      });
  
    return ret;
  }
  