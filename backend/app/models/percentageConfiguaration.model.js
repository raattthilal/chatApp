module.exports = function PercentageConfiguaration(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('percentageConfiguaration', {
        name: {
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
        tableName: 'percentage_configuaration',
        timestamps: false
  
      });
    return ret;
  }
  