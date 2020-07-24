module.exports = function LsgiBlock(sequelize) {
  var Sequelize = sequelize.constructor;
  var district = require('./district.model') (sequelize);

  var ret =
    sequelize.define('lsgiBlock', {
      name_en: {
        type: Sequelize.STRING
      },
      name_ml: {
        type: Sequelize.STRING
      },
      district_id: {
        type: Sequelize.INTEGER,
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
      tableName: 'lsgi_block',
      timestamps: false

    });

  
      ret.belongsTo(district, {foreignKey: 'district_id'});

  return ret;
}
