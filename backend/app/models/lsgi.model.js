module.exports = function Lsgi(sequelize) {
    var Sequelize = sequelize.constructor;
    var lsgiType = require('./lsgiType.model') (sequelize);
    var district = require('./district.model') (sequelize);
    var lsgiBlock = require('./lsgiBlock.model') (sequelize);
    var ret =
      sequelize.define('lsgi', {
        name_en: {
          type: Sequelize.STRING
        },
        name_ml: {
          type: Sequelize.STRING
        },
        lsgi_type_id: {
            type: Sequelize.INTEGER
        },
        district_id: {
            type: Sequelize.INTEGER
        },
        lsgi_block_id: {
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
        tableName: 'lsgi',
        timestamps: false
  
      });
    //   ret.relations = {
    //     lsgiType:lsgiType,
    //     lsgiBlock:lsgiBlock
    // };
      ret.belongsTo(lsgiType, {foreignKey: 'lsgi_type_id'});
      ret.belongsTo(district, {foreignKey: 'district_id'});
      // // lsgiType.hasMany(ret, {foreignKey: 'lsgi_type_id'});
      ret.belongsTo(lsgiBlock, {foreignKey: 'lsgi_block_id'});
  
    return ret;
  }
  