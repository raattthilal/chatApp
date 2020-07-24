module.exports = function LsgiType(sequelize) {
  var Sequelize = sequelize.constructor;
  var ret =
    sequelize.define('lsgiType', {
      name_en: {
        type: Sequelize.STRING
      },
      name_ml: {
        type: Sequelize.STRING
      },
      show_block_panchayath: {
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
      tableName: 'lsgi_type',
      timestamps: false

    });
  return ret;
}
