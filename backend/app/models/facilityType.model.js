module.exports = function FacilityType(sequelize) {
    var Sequelize = sequelize.constructor;
    // var district = require('./district.model') (sequelize);
   // var facilitySurvey = require('./facilitySurvey.model') (sequelize);
    var category = require('./category.model') (sequelize);
    var ret =
      sequelize.define('facilityType', {
        name_en: {
          type: Sequelize.STRING
        },
        name_ml: {
          type: Sequelize.STRING
        },
        category_id: {
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
        tableName: 'facility_type',
        timestamps: false
  
      });
      ret.belongsTo(category, {foreignKey: 'category_id'});
    //  ret.hasMany(facilitySurvey, {foreignKey: 'facility_type_id'});
      //   ret.relations = {
    //     lsgiType:lsgiType,
    //     lsgiBlock:lsgiBlock
    // };
    //   ret.belongsTo(lsgiType, {foreignKey: 'lsgi_type_id'});
    //   // lsgiType.hasMany(ret, {foreignKey: 'lsgi_type_id'});
    //   ret.belongsTo(lsgiBlock, {foreignKey: 'lsgi_block_id'});
  
    return ret;
  }
  