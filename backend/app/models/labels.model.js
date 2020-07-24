module.exports = function Labels(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('labels', {
        key_text: {
          type: Sequelize.STRING
        },
        value_en: {
          type: Sequelize.STRING
        },
        value_ml: {
          type: Sequelize.STRING
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
        tableName: 'labels',
        timestamps: false
  
      });
  
    return ret;
  }
  