module.exports = function OfficeType(sequelize) {
  // var lsgiBlock = require('./lsgiBlock.model')(sequelize);
  var Sequelize = sequelize.constructor;
  var ret =
    sequelize.define('officeType', {
   
      name: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING
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
      tableName: 'office_type',
      timestamps: false

    });
    // ret.relations = {
  //     lsgiBlock: lsgiBlock
  // };
  // ret.hasMany(lsgiBlock, {foreignKey: 'district_id'});
  // lsgiBlock.hasOne(ret, {foreignKey: 'district_id'});
    
  return ret;
}
