module.exports = function User(sequelize) {
    var Sequelize = sequelize.constructor;
    var lsgi = require('./lsgi.model') (sequelize);
    var lsgiType = require('./lsgiType.model') (sequelize);
    var district = require('./district.model') (sequelize);
    var lsgiBlock = require('./lsgiBlock.model') (sequelize);
    var authRole = require('./authRole.model') (sequelize);
    var authRolePermission = require('./authRolePermission.model') (sequelize);

    var ret =
      sequelize.define('user', {
        name: {
          type: Sequelize.STRING
        },
        middle_name: {
          type: Sequelize.STRING
        },
        last_name: {
          type: Sequelize.STRING
        },
        designation: {
          type: Sequelize.STRING
        },
        gender: {
          type: Sequelize.STRING
        },
        email: {
          type: Sequelize.STRING
        },
        phone: {
          type: Sequelize.STRING
        },
        password: {
          type: Sequelize.STRING
        },
        user_type: {
          type: Sequelize.STRING
        },
          player_id: {
              type: Sequelize.STRING
          },
        lsgi_id: {
          type: Sequelize.INTEGER
        },
        district_id: {
          type: Sequelize.INTEGER
        },
        lsgi_type_id: {
          type: Sequelize.INTEGER
        },
        lsgi_block_id: {
          type: Sequelize.INTEGER
        },
        role_id:{
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
        tableName: 'user',
        timestamps: false
  
      });
      ret.belongsTo(lsgi, {foreignKey: 'lsgi_id' ,as: 'lsgi'});
      ret.belongsTo(lsgiType, {foreignKey: 'lsgi_type_id', as: 'lsgi_type'});
      ret.belongsTo(district, {foreignKey: 'district_id',as: 'district'});
      ret.belongsTo(lsgiBlock, {foreignKey: 'lsgi_block_id',as: 'lsgi_block'});
      ret.belongsTo(authRole, {foreignKey: 'role_id',as: 'role'});
      ret.hasMany(authRolePermission, {foreignKey: 'role_id',sourceKey : 'role_id', as: 'rolepermission'});
  
    return ret;
  }
  