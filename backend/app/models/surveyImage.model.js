module.exports = function SurveyImage(sequelize) {
    var Sequelize = sequelize.constructor;
    // var lsgiType = require('./lsgiType.model') (sequelize);
    var image = require('./image.model') (sequelize);
    var ret =
      sequelize.define('srveyImage', {
        survey_id: {
          type: Sequelize.STRING
        },
        image_id: {
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
        tableName: 'survey_image',
        timestamps: false
  
      });
      ret.belongsTo(image, {foreignKey: 'image_id'});
      // ret.belongsTo(district, {foreignKey: 'district_id'});
    //   ret.relations = {
    //     lsgiType:lsgiType,
    //     lsgiBlock:lsgiBlock
    // };
    //   ret.belongsTo(lsgiType, {foreignKey: 'lsgi_type_id'});
    //   // lsgiType.hasMany(ret, {foreignKey: 'lsgi_type_id'});
    //   ret.belongsTo(lsgiBlock, {foreignKey: 'lsgi_block_id'});
  
    return ret;
  }
  